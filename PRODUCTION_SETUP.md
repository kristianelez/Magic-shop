# Production Database Setup - Greentime CRM

## Problem: Prazna baza u objavljenoj (published) aplikaciji

Kada prvi put objavite aplikaciju na Replit-u, stvara se **potpuno nova, prazna production baza podataka** koja je odvojena od development baze.

### Zašto se to dešava?

- **Development baza** = Baza koju koristite dok testirate kod (ima sve podatke: 128 proizvoda, 69 kupaca)
- **Production baza** = Nova baza koja se kreira kada objavite aplikaciju (potpuno prazna)

## Rješenje: Resetovanje production baze

### Opcija 1: Resetovanje putem Replit interfejsa (PREPORUČENO)

1. **Otvori Database panel** u Replit-u
2. **Prebaci se na "Production Database"** tab (pored "Development Database")
3. **Obriši sve tabele** ili koristi opciju "Drop all tables"
4. **Republish aplikaciju** - Klikni na "Publish" dugme ponovo
5. **Prva pokretanja** - Kada se aplikacija pokrene, seed skripta će automatski:
   - Kreirati 3 korisnika (PredragPetrusic, DraganElez, Greentimeadmin)
   - Importovati **128 proizvoda** sa greentime.ba
   - Importovati **69 kupaca** iz Excel fajla

### Opcija 2: Ručno pokretanje seed skripte (Alternativa)

Ako želite ručno pokrenuti import:

```bash
# Povezati se na production bazu i pokrenuti:
tsx server/import-greentime-products.ts
tsx server/import-customers.ts
```

## Automatski import u seed skripti

Seed skripta (`server/seed.ts`) sada automatski:

1. **Provjerava da li postoje podaci u bazi** - Provjerava i proizvode i kupce
2. **Ako je baza prazna**, automatski importuje:
   - Kreira 3 korisnika sa šifrovanim passwordima
   - Poziva `importGreentimeProducts()` - Importuje 128 proizvoda sa greentime.ba
   - Poziva `importCustomersFromExcel()` - Importuje 69 kupaca iz Excel-a

### Safety Checks (Zaštita od gubitka podataka)

Import sistem ima **trostruku zaštitu** od greške:

1. **Pre-scraping validacija**: Provjerava da je prikupljeno minimum 100 proizvoda sa website-a
2. **Pre-deletion validacija**: Provjerava brojeve PRIJE nego obriše postojeće proizvode
3. **Post-import validacija**: Provjerava da baza ima minimum 100 proizvoda nakon importa

**Ako bilo koji korak failuje, import se zaustavlja i baza ostaje netaknuta.**

## Provjera da li je sve u redu

Nakon što republish-ujete aplikaciju:

1. Prijavite se sa: **PredragPetrusic** / **pedja2024**
2. Idite na stranicu **Proizvodi** - Trebalo bi da vidite **128 proizvoda**
3. Idite na stranicu **Kupci** - Trebalo bi da vidite **69 kupaca**

## Korisnici (automatski kreirani)

| Username | Password | Uloga |
|----------|----------|-------|
| PredragPetrusic | pedja2024 | sales_manager |
| DraganElez | kacacaka0607 | sales_director |
| Greentimeadmin | kikoris12 | admin |

## Napomena

- **NE TREBA** ručno dodavati proizvode ili kupce
- Seed skripta će automatski uvesti sve podatke pri prvom pokretanju
- Podaci se importuju iz:
  - **Proizvodi**: greentime.ba website (live scraping)
  - **Kupci**: Excel fajl `Analiza prodaje Predrag Petrušić_*.xlsx`

## Važne napomene za održavanje

### Environment Variables u Production

Provjerite da su svi potrebni environment variables postavljeni u production:

1. **DATABASE_URL** - Automatski postavljen od strane Replit-a
2. **SESSION_SECRET** - OBAVEZNO - Koristite jak random string
3. **OPENAI_API_KEY** - Opcionalno (za AI preporuke)

### Kako dodati Environment Variables u Production

1. Idi u **Secrets** tab u Replit workspace-u
2. Dodaj secrets (oni se automatski sinkronizuju sa published app-om)
3. Republish aplikaciju

## Debugging production problema

Ako i dalje ne vidite podatke nakon republish-a:

1. **Provjeri production database** - Ima li tabela? Ima li podataka?
2. **Provjeri logs** - Potraži greške tokom seed-a
3. **Provjeri da li seed skripta radi** - Trebala bi ispisati:
   ```
   ═══════════════════════════════════════════════════════
     DATABASE SEEDING STARTED
   ═══════════════════════════════════════════════════════

   Creating users...
   ✓ Created 3 users

   Importing Greentime products...
   Fetching products from greentime.ba...
   ✓ Scraping successful: XXX products collected
   ✓ Filtering successful: 128 unique products ready for import
   Clearing existing products...
   Inserting products into database...
   ✓ Successfully imported 128 products
   ✓ Import verification successful: 128 products in database
   ✓ Greentime products imported successfully

   Importing customers from Excel...
   ✓ Successfully imported 68 customers!
   ✓ Customers imported successfully

   ═══════════════════════════════════════════════════════
     DATABASE SEEDING COMPLETED
   ═══════════════════════════════════════════════════════
     ✓ Users: 3
     ✓ Products: 128
     ✓ Customers: 68
   ═══════════════════════════════════════════════════════
   ```

4. **Ako vidite ERROR poruke**:
   - `❌ SAFETY CHECK FAILED` - Scraping sa greentime.ba nije uspio (network problem ili promjena website-a)
   - `❌ IMPORT VERIFICATION FAILED` - Database insert nije uspio
   - `❌ CRITICAL: Failed to import` - Import je failovao, baza ostaje prazna

5. **U slučaju greške**:
   - Resetuj production bazu (obriši sve tabele)
   - Republish aplikaciju ponovo
   - Ako problem ostaje, kontaktiraj podršku

## Kontakt za podršku

Ako imate problema sa production bazom, kontaktirajte Replit support ili provjerite:
- Database connection string
- Permissions
- Firewall settings
