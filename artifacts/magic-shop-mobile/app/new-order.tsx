import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

interface Customer {
  id: number;
  name: string;
  company: string;
}

interface Product {
  id: number;
  name: string;
  category: string;
  price: string;
  stock: number;
  unit: string;
  promoPrice?: string | null;
}

interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

function formatBAM(value: number) {
  return value.toLocaleString("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " KM";
}

export default function NewOrderScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api<Customer[]>("/api/customers"),
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api<Product[]>("/api/products"),
  });

  const total = useMemo(
    () =>
      items.reduce(
        (sum, it) => sum + it.quantity * it.unitPrice * (1 - it.discount / 100),
        0
      ),
    [items]
  );

  const addProduct = (p: Product) => {
    const price = p.promoPrice ? parseFloat(p.promoPrice) : parseFloat(p.price);
    setItems((prev) => {
      const existing = prev.find((it) => it.productId === p.id);
      if (existing) {
        return prev.map((it) =>
          it.productId === p.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          quantity: 1,
          unitPrice: price,
          discount: 0,
        },
      ];
    });
    setShowProductPicker(false);
  };

  const updateItem = (productId: number, patch: Partial<OrderItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, ...patch } : it))
    );
  };

  const removeItem = (productId: number) =>
    setItems((prev) => prev.filter((it) => it.productId !== productId));

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!customer) throw new Error("Odaberite kupca");
      if (items.length === 0) throw new Error("Dodajte barem jedan proizvod");
      const payload = {
        customerId: customer.id,
        total: total.toFixed(2),
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice.toFixed(2),
          discount: it.discount.toString(),
          subtotal: (it.quantity * it.unitPrice * (1 - it.discount / 100)).toFixed(2),
        })),
      };
      return api("/api/sales", { method: "POST", body: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      Alert.alert("Uspjeh", "Narudžba je spremljena.");
      router.back();
    },
    onError: (e: any) => {
      Alert.alert("Greška", e?.message || "Nije moguće sačuvati narudžbu");
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
        bottomOffset={100}
      >
        <Text style={[styles.section, { color: colors.mutedForeground }]}>KUPAC</Text>
        <TouchableOpacity
          style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowCustomerPicker(true)}
          activeOpacity={0.8}
        >
          <Feather name="user" size={18} color={colors.copper} />
          <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium" }}>
            {customer ? `${customer.company} (${customer.name})` : "Odaberite kupca"}
          </Text>
          <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <Text style={[styles.section, { color: colors.mutedForeground, marginTop: 8 }]}>
          STAVKE
        </Text>

        {items.map((it) => (
          <View
            key={it.productId}
            style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={[styles.itemTitle, { color: colors.foreground, flex: 1 }]}
                numberOfLines={1}
              >
                {it.productName}
              </Text>
              <TouchableOpacity onPress={() => removeItem(it.productId)}>
                <Feather name="x" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </View>

            <View style={styles.itemRow}>
              <Field
                label="Količina"
                value={String(it.quantity)}
                onChangeText={(t) =>
                  updateItem(it.productId, { quantity: Math.max(1, parseInt(t) || 1) })
                }
                colors={colors}
              />
              <Field
                label="Cijena"
                value={String(it.unitPrice)}
                onChangeText={(t) =>
                  updateItem(it.productId, { unitPrice: parseFloat(t) || 0 })
                }
                colors={colors}
              />
              <Field
                label="Popust %"
                value={String(it.discount)}
                onChangeText={(t) =>
                  updateItem(it.productId, {
                    discount: Math.max(0, Math.min(100, parseFloat(t) || 0)),
                  })
                }
                colors={colors}
              />
            </View>
            <Text style={{ color: colors.copper, fontFamily: "Inter_600SemiBold", marginTop: 8 }}>
              Iznos: {formatBAM(it.quantity * it.unitPrice * (1 - it.discount / 100))}
            </Text>
          </View>
        ))}

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
          <Text style={{ color: colors.copperLight, fontSize: 20, fontFamily: "Inter_700Bold" }}>
            {formatBAM(total)}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: colors.copper, opacity: submitMutation.isPending ? 0.6 : 1 },
          ]}
          onPress={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
          activeOpacity={0.85}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Sačuvaj</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <PickerModal
        visible={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        title="Odaberi kupca"
        data={customers ?? []}
        keyExtractor={(c) => String(c.id)}
        renderLabel={(c) => `${c.company} — ${c.name}`}
        onSelect={(c) => {
          setCustomer(c);
          setShowCustomerPicker(false);
        }}
        colors={colors}
      />

      <PickerModal
        visible={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        title="Odaberi proizvod"
        data={products ?? []}
        keyExtractor={(p) => String(p.id)}
        renderLabel={(p) =>
          `${p.name} — ${formatBAM(parseFloat(p.promoPrice || p.price))}`
        }
        onSelect={addProduct}
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
  colors: any;
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
          { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
        ]}
      />
    </View>
  );
}

function PickerModal<T>({
  visible,
  onClose,
  title,
  data,
  keyExtractor,
  renderLabel,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  data: T[];
  keyExtractor: (item: T) => string;
  renderLabel: (item: T) => string;
  onSelect: (item: T) => void;
  colors: any;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      q
        ? data.filter((it) =>
            renderLabel(it).toLowerCase().includes(q.toLowerCase())
          )
        : data,
    [q, data, renderLabel]
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
          <Text style={{ color: colors.copperLight, fontSize: 17, fontFamily: "Inter_600SemiBold" }}>
            {title}
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
          keyExtractor={keyExtractor}
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
                {renderLabel(item)}
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

const styles = StyleSheet.create({
  section: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6 },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  itemTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  itemRow: { flexDirection: "row", gap: 8, marginTop: 10 },
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
