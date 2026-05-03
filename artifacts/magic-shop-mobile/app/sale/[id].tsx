import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { api, ApiError } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import type { ColorTokens } from "@/constants/colors";

interface Sale {
  id: number;
  customerId: number;
  productId: number;
  sizeId?: number | null;
  quantity: number;
  totalAmount: string;
  discount: string;
  status: string;
  createdAt: string;
}

interface ProductSize {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  price: string;
  promoPrice?: string | null;
  unit?: string;
  sizes?: ProductSize[];
}

interface Customer {
  id: number;
  name: string;
  company: string;
}

// Stavka u editor formi. saleId postoji samo ako stavka već postoji u bazi.
// isDeleted = true znači da postojeću stavku treba obrisati pri spremanju.
interface OrderItem {
  saleId?: number;
  productId: number;
  productName: string;
  productSizes: ProductSize[];
  sizeId: number | null;
  quantity: string;
  // Bazna jedinična cijena PRIJE popusta (na bazi nje + discount izračunavamo
  // totalAmount koji ide u bazu).
  unitPrice: string;
  discount: string;
  isDeleted?: boolean;
}

function formatBAM(value: number) {
  return (
    value.toLocaleString("bs-BA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " KM"
  );
}

// Ključ grupe — isti kupac + ista minuta = jedna narudžba (kao na webu).
function groupKey(customerId: number, createdAt: string | Date) {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${customerId}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}-${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  const saleId = Number(id);

  // Učitamo cijelu listu prodaja jednom — iz nje izvadimo grupu narudžbe.
  // Web app radi isto u EditOrder.tsx.
  const {
    data: sales,
    isLoading: salesLoading,
    error: salesError,
  } = useQuery({
    queryKey: ["sales"],
    queryFn: () => api<Sale[]>("/api/sales"),
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api<Product[]>("/api/products"),
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api<Customer[]>("/api/customers"),
  });

  const anchor = useMemo(
    () => sales?.find((s) => s.id === saleId),
    [sales, saleId],
  );

  const groupSales = useMemo(() => {
    if (!anchor || !sales) return [];
    const key = groupKey(anchor.customerId, anchor.createdAt);
    return sales
      .filter(
        (s) => s.customerId === anchor.customerId && groupKey(s.customerId, s.createdAt) === key,
      )
      .sort((a, b) => a.id - b.id);
  }, [sales, anchor]);

  const customer = useMemo(
    () => customers?.find((c) => c.id === anchor?.customerId),
    [customers, anchor],
  );

  const [items, setItems] = useState<OrderItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [sizePickerFor, setSizePickerFor] = useState<number | null>(null);

  // Hidratiraj formu iz grupisane narudžbe. Iz baze imamo totalAmount,
  // quantity i discount(%). Da editovanje ne uvodi dvostruki popust, vadimo
  // baznu (pre-discount) jediničnu cijenu:
  //   total = qty * basePrice * (1 - discount/100)
  //   basePrice = total / (qty * (1 - discount/100))
  // Tako, ako korisnik ne mijenja discount, totalAmount ostaje identičan
  // postojećem; ako mijenja, totalAmount se proporcionalno mijenja.
  useEffect(() => {
    if (hydrated) return;
    if (salesLoading || productsLoading || customersLoading) return;
    if (!anchor || !products) return;
    const formItems: OrderItem[] = groupSales.map((s) => {
      const p = products.find((pp) => pp.id === s.productId);
      const total = parseFloat(s.totalAmount);
      const qty = s.quantity || 1;
      const disc = parseFloat(s.discount || "0") || 0;
      const denom = qty * (1 - disc / 100);
      const basePrice = denom > 0 ? total / denom : 0;
      return {
        saleId: s.id,
        productId: s.productId,
        productName: p?.name ?? `Artikal #${s.productId}`,
        productSizes: p?.sizes ?? [],
        sizeId: s.sizeId ?? null,
        quantity: String(qty),
        unitPrice: basePrice.toFixed(2),
        discount: disc ? String(disc) : "0",
      };
    });
    setItems(formItems);
    setHydrated(true);
  }, [hydrated, salesLoading, productsLoading, customersLoading, anchor, products, groupSales]);

  const activeItems = items.filter((it) => !it.isDeleted);
  const total = useMemo(
    () =>
      activeItems.reduce((sum, it) => {
        const q = parseFloat(it.quantity) || 0;
        const p = parseFloat(it.unitPrice) || 0;
        const d = parseFloat(it.discount) || 0;
        return sum + q * p * (1 - d / 100);
      }, 0),
    [activeItems],
  );

  const updateItem = (index: number, patch: Partial<OrderItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => {
      const it = prev[index];
      if (it.saleId) {
        // Postojeća stavka — označi za brisanje (PATCH/DELETE radi se na save).
        return prev.map((x, i) => (i === index ? { ...x, isDeleted: true } : x));
      }
      // Nova stavka — samo izbaci.
      return prev.filter((_, i) => i !== index);
    });
  };

  const addProduct = (p: Product) => {
    const price = p.promoPrice ? parseFloat(p.promoPrice) : parseFloat(p.price);
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        productSizes: p.sizes ?? [],
        sizeId: null,
        quantity: "1",
        unitPrice: price.toFixed(2),
        discount: "0",
      },
    ]);
    setShowProductPicker(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!anchor) throw new Error("Narudžba nije učitana");
      if (activeItems.length === 0)
        throw new Error("Narudžba mora imati barem jednu stavku");

      // Validacije
      for (const it of activeItems) {
        const q = parseInt(it.quantity);
        if (!q || q < 1) throw new Error(`Nevažeća količina za "${it.productName}"`);
        const p = parseFloat(it.unitPrice);
        if (Number.isNaN(p) || p < 0)
          throw new Error(`Nevažeća cijena za "${it.productName}"`);
        const d = parseFloat(it.discount);
        if (Number.isNaN(d) || d < 0 || d > 100)
          throw new Error(`Popust za "${it.productName}" mora biti između 0 i 100`);
        if (it.productSizes.length > 0 && !it.sizeId)
          throw new Error(`Odaberite veličinu za "${it.productName}"`);
      }

      // 1) Briši stavke označene za brisanje
      for (const it of items) {
        if (it.isDeleted && it.saleId) {
          await api(`/api/sales/${it.saleId}`, { method: "DELETE" });
        }
      }

      // 2) Update postojećih i kreiraj nove. Nove stavke kreiramo sa istim
      // createdAt kao anchor — inače bi server postavio defaultNow() i nova
      // stavka bi pala u drugu (trenutnu) "minutu" → ne bi se grupisala s
      // ovom narudžbom pri sljedećem otvaranju.
      const anchorCreatedAtIso = new Date(anchor.createdAt).toISOString();
      for (const it of activeItems) {
        const q = parseInt(it.quantity);
        const p = parseFloat(it.unitPrice);
        const d = parseFloat(it.discount) || 0;
        // totalAmount = qty * basePrice * (1 - discount/100); šaljemo i
        // discount(%) tako da DB zapis ostane konzistentan i da hidracija
        // pri sljedećem otvaranju izvuče istu baznu cijenu.
        const lineTotal = q * p * (1 - d / 100);
        const hasSizes = it.productSizes.length > 0;
        const sizeIdForPayload: number | null = hasSizes ? it.sizeId : null;

        if (it.saleId) {
          const payload: Record<string, unknown> = {
            productId: it.productId,
            quantity: q,
            totalAmount: lineTotal.toFixed(2),
            discount: d.toString(),
            sizeId: sizeIdForPayload,
          };
          await api(`/api/sales/${it.saleId}`, {
            method: "PATCH",
            body: payload,
          });
        } else {
          const payload: Record<string, unknown> = {
            customerId: anchor.customerId,
            productId: it.productId,
            quantity: q,
            totalAmount: lineTotal.toFixed(2),
            discount: d.toString(),
            status: "completed",
            createdAt: anchorCreatedAtIso,
          };
          if (sizeIdForPayload !== null) payload.sizeId = sizeIdForPayload;
          await api("/api/sales", { method: "POST", body: payload });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      Alert.alert("Uspjeh", "Narudžba je ažurirana.");
      router.back();
    },
    onError: (e: Error) => {
      Alert.alert(
        "Greška",
        e instanceof ApiError ? e.message : e.message || "Nije moguće sačuvati izmjene",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Obriši sve sale zapise grupisane narudžbe.
      for (const s of groupSales) {
        await api(`/api/sales/${s.id}`, { method: "DELETE" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      Alert.alert("Obrisano", "Narudžba je obrisana.");
      router.back();
    },
    onError: (e: Error) => {
      Alert.alert("Greška", e.message || "Nije moguće obrisati narudžbu");
    },
  });

  const confirmDelete = () => {
    Alert.alert(
      "Brisanje narudžbe",
      `Da li sigurno želite obrisati cijelu narudžbu (${groupSales.length} stavki)? Ova radnja je nepovratna.`,
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Obriši",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  // Ako su podaci učitani ali anchor (sale) nije pronađen, prikazujemo
  // grešku umjesto beskonačnog spinnera (stale deep-link / obrisana
  // narudžba).
  const dataReady = !salesLoading && !productsLoading && !customersLoading;
  if (dataReady && (salesError || !anchor)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.destructive }}>Narudžba nije pronađena</Text>
      </View>
    );
  }

  if (!dataReady || !hydrated) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  if (salesError || !anchor) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.destructive }}>Narudžba nije pronađena</Text>
      </View>
    );
  }

  const busy = saveMutation.isPending || deleteMutation.isPending;
  const sizePickerItem =
    sizePickerFor != null ? items[sizePickerFor] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 140 }}
        bottomOffset={100}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.label, { color: colors.mutedForeground }]}>KUPAC</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {customer
              ? `${customer.company} (${customer.name})`
              : `Kupac #${anchor.customerId}`}
          </Text>
          <View style={{ height: 12 }} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>DATUM</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {new Date(anchor.createdAt).toLocaleString("bs-BA")}
          </Text>
        </View>

        <Text style={[styles.section, { color: colors.mutedForeground }]}>STAVKE</Text>

        {activeItems.length === 0 && (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 16 }}>
            Nema stavki. Dodajte barem jedan proizvod.
          </Text>
        )}

        {items.map((it, index) => {
          if (it.isDeleted) return null;
          const selectedSize = it.productSizes.find((s) => s.id === it.sizeId);
          const q = parseFloat(it.quantity) || 0;
          const p = parseFloat(it.unitPrice) || 0;
          const d = parseFloat(it.discount) || 0;
          const lineTotal = q * p * (1 - d / 100);
          return (
            <View
              key={`${it.saleId ?? "new"}-${index}`}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={[styles.itemTitle, { color: colors.foreground, flex: 1 }]}
                  numberOfLines={1}
                >
                  {it.productName}
                </Text>
                <TouchableOpacity onPress={() => removeItem(index)}>
                  <Feather name="x" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>

              {it.productSizes.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.picker,
                    { borderColor: colors.border, backgroundColor: colors.background },
                  ]}
                  onPress={() => setSizePickerFor(index)}
                  activeOpacity={0.8}
                >
                  <Feather name="tag" size={14} color={colors.copper} />
                  <Text
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                    }}
                  >
                    {selectedSize ? `Veličina: ${selectedSize.name}` : "Odaberite veličinu"}
                  </Text>
                  <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}

              <View style={styles.row}>
                <Field
                  label="Količina"
                  value={it.quantity}
                  onChangeText={(t) => updateItem(index, { quantity: t })}
                  colors={colors}
                />
                <Field
                  label="Cijena"
                  value={it.unitPrice}
                  onChangeText={(t) => updateItem(index, { unitPrice: t })}
                  colors={colors}
                />
                <Field
                  label="Popust %"
                  value={it.discount}
                  onChangeText={(t) => updateItem(index, { discount: t })}
                  colors={colors}
                />
              </View>
              <Text
                style={{
                  color: colors.copper,
                  fontFamily: "Inter_600SemiBold",
                  marginTop: 8,
                }}
              >
                Iznos: {formatBAM(lineTotal)}
              </Text>
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.addBtn, { borderColor: colors.copper }]}
          onPress={() => setShowProductPicker(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color={colors.copper} />
          <Text style={{ color: colors.copper, fontFamily: "Inter_600SemiBold" }}>
            Dodaj proizvod
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: colors.destructive }]}
          onPress={confirmDelete}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Feather name="trash-2" size={18} color={colors.destructive} />
          <Text
            style={{ color: colors.destructive, fontFamily: "Inter_600SemiBold" }}
          >
            Obriši cijelu narudžbu
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: colors.sidebar, borderTopColor: colors.sidebarBorder },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#A89E8E", fontSize: 11, fontFamily: "Inter_500Medium" }}>
            UKUPNO
          </Text>
          <Text
            style={{
              color: colors.copperLight,
              fontSize: 20,
              fontFamily: "Inter_700Bold",
            }}
          >
            {formatBAM(total)}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: colors.copper, opacity: busy ? 0.6 : 1 },
          ]}
          onPress={() => saveMutation.mutate()}
          disabled={busy}
          activeOpacity={0.85}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Sačuvaj</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ProductPickerModal
        visible={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        products={products ?? []}
        onSelect={addProduct}
        colors={colors}
      />

      <SizePickerModal
        visible={sizePickerFor != null}
        onClose={() => setSizePickerFor(null)}
        sizes={sizePickerItem?.productSizes ?? []}
        onSelect={(sizeId) => {
          if (sizePickerFor != null) {
            updateItem(sizePickerFor, { sizeId });
          }
          setSizePickerFor(null);
        }}
        colors={colors}
      />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  colors: ColorTokens;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        style={[
          styles.fieldInput,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
          },
        ]}
      />
    </View>
  );
}

function ProductPickerModal({
  visible,
  onClose,
  products,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  onSelect: (p: Product) => void;
  colors: ColorTokens;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => (q ? products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : products),
    [q, products],
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            padding: 16,
            backgroundColor: colors.sidebar,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={colors.copperLight} />
          </TouchableOpacity>
          <Text
            style={{
              color: colors.copperLight,
              fontSize: 17,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            Odaberi proizvod
          </Text>
        </View>
        <View style={{ padding: 12 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Pretraga..."
            placeholderTextColor={colors.mutedForeground}
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              color: colors.foreground,
              fontFamily: "Inter_400Regular",
            }}
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                onSelect(item);
                setQ("");
              }}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                {item.name} —{" "}
                {formatBAM(parseFloat(item.promoPrice || item.price))}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text
              style={{
                textAlign: "center",
                marginTop: 32,
                color: colors.mutedForeground,
              }}
            >
              Nema rezultata
            </Text>
          }
        />
      </View>
    </Modal>
  );
}

function SizePickerModal({
  visible,
  onClose,
  sizes,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  sizes: ProductSize[];
  onSelect: (sizeId: number) => void;
  colors: ColorTokens;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            padding: 16,
            backgroundColor: colors.sidebar,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={colors.copperLight} />
          </TouchableOpacity>
          <Text
            style={{
              color: colors.copperLight,
              fontSize: 17,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            Odaberi veličinu
          </Text>
        </View>
        <FlatList
          data={sizes}
          keyExtractor={(s) => String(s.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onSelect(item.id)}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 12, borderWidth: 1, padding: 14 },
  section: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  value: { fontSize: 15, fontFamily: "Inter_500Medium" },
  itemTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  fieldLabel: { fontSize: 10, fontFamily: "Inter_500Medium", marginBottom: 4 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    marginTop: 4,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    marginTop: 12,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
});
