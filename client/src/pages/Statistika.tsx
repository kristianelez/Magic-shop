import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Users } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend,
  LineChart, Line, Area, AreaChart
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { bs } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import type { Sale, User } from "@shared/schema";

interface SaleWithProduct extends Sale {
  productName?: string;
  productCategory?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function Statistika() {
  const { user } = useAuth();
  const isSalesDirector = user?.role === "sales_director" || user?.role === "admin";

  const { data: sales = [], isLoading: salesLoading } = useQuery<SaleWithProduct[]>({
    queryKey: ["/api/sales"],
    staleTime: 30 * 60 * 1000,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    staleTime: 30 * 60 * 1000,
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    staleTime: 30 * 60 * 1000,
  });

  const now = new Date();
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(now, 5 - i);
    return {
      month: format(date, "MMM", { locale: bs }),
      monthFull: format(date, "MMMM yyyy", { locale: bs }),
      start: startOfMonth(date),
      end: endOfMonth(date),
    };
  });

  const salesPersonData = last6Months.map(month => {
    const monthSales = sales.filter(sale => 
      isWithinInterval(new Date(sale.createdAt), { start: month.start, end: month.end })
    );

    const dataPoint: any = { month: month.month };
    
    const salesBySalesPerson = new Map<string, number>();
    monthSales.forEach(sale => {
      const salesPersonId = sale.salesPersonId || "unknown";
      const current = salesBySalesPerson.get(salesPersonId) || 0;
      salesBySalesPerson.set(salesPersonId, current + parseFloat(sale.totalAmount) / 1.17);
    });

    salesBySalesPerson.forEach((amount, salesPersonId) => {
      const user = users.find(u => u.id === salesPersonId);
      const name = user?.fullName || "Nepoznat";
      dataPoint[name] = Math.round(amount);
    });

    return dataPoint;
  });

  const uniqueSalesPersons = Array.from(new Set(sales.map(s => s.salesPersonId).filter(Boolean)));
  const salesPersonNames = uniqueSalesPersons.map(id => {
    const user = users.find(u => u.id === id);
    return user?.fullName || "Nepoznat";
  });

  const categoryData = (() => {
    const categoryMap = new Map<string, number>();
    sales.forEach(sale => {
      const product = products.find(p => p.id === sale.productId);
      const category = product?.category || "Ostalo";
      const current = categoryMap.get(category) || 0;
      categoryMap.set(category, current + parseFloat(sale.totalAmount) / 1.17);
    });

    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) + "..." : name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  })();

  const trendData = last6Months.map(month => {
    const monthSales = sales.filter(sale => 
      isWithinInterval(new Date(sale.createdAt), { start: month.start, end: month.end })
    );
    const total = monthSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount) / 1.17, 0);
    return {
      month: month.month,
      prodaja: Math.round(total),
    };
  });

  if (salesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Učitavanje statistike...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-statistika">
          <BarChart3 className="h-6 w-6 text-primary" />
          Statistika
        </h1>
        <p className="text-muted-foreground">
          Pregled prodaje po komercijalisti i kategorijama
        </p>
      </div>

      {isSalesDirector && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Ukupan promet po komercijalisti (bez PDV-a)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {users
                .filter(u => u.role === "sales_manager" || u.role === "komercijalista")
                .map(salesperson => {
                  const personSales = sales.filter(s => s.salesPersonId === salesperson.id);
                  const total = personSales.reduce((sum, s) => sum + parseFloat(s.totalAmount) / 1.17, 0);
                  return (
                    <div 
                      key={salesperson.id} 
                      className="p-4 rounded-lg bg-muted/50 border"
                      data-testid={`card-sales-${salesperson.username}`}
                    >
                      <p className="text-sm text-muted-foreground">{salesperson.fullName}</p>
                      <p className="text-2xl font-bold text-primary">
                        {total.toLocaleString("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {personSales.length} prodaja
                      </p>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Prodaja po komercijalisti (bez PDV-a)
          </CardTitle>
          <p className="text-sm text-muted-foreground">Zadnjih 6 mjeseci</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="w-full h-[280px] sm:h-[320px]" data-testid="chart-sales-by-person">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={salesPersonData} 
                margin={{ top: 20, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  width={40}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toLocaleString()} KM`, ""]}
                  labelFormatter={(label) => `Mjesec: ${label}`}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  iconSize={10}
                />
                {salesPersonNames.map((name, index) => (
                  <Bar 
                    key={name} 
                    dataKey={name} 
                    fill={COLORS[index % COLORS.length]} 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="h-4 w-4" />
              Prodaja po kategorijama
            </CardTitle>
            <p className="text-sm text-muted-foreground">Top 6 kategorija</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="w-full h-[280px]" data-testid="chart-by-category">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString()} KM`, "Prodaja"]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Trend prodaje
            </CardTitle>
            <p className="text-sm text-muted-foreground">Ukupna mjesečna prodaja</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="w-full h-[280px]" data-testid="chart-trend">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={trendData}
                  margin={{ top: 20, right: 10, left: -10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorProdaja" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0088FE" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0088FE" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString()} KM`, "Prodaja"]}
                    labelFormatter={(label) => `Mjesec: ${label}`}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="prodaja" 
                    stroke="#0088FE" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorProdaja)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
