import { useId } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface MetricChartDatum {
  label: string;
  value: number;
  secondary?: number;
}

interface MetricChartProps {
  data: MetricChartDatum[];
  type?: 'line' | 'area' | 'bar';
  color?: string;
  unit?: string;
  height?: number;
  secondaryLabel?: string;
}

const axisTick = { fill: '#6b7280', fontSize: 11 };
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' };

export function MetricChart({ data, type = 'line', color = '#10b981', unit, height = 180, secondaryLabel }: MetricChartProps) {
  const gradientId = useId().replace(/:/g, '');

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} unit={unit} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={['auto', 'auto']} unit={unit} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="value" stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} dot={{ fill: color, r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={['auto', 'auto']} unit={unit} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} />
        {data.some(d => d.secondary !== undefined) && (
          <Line type="monotone" dataKey="secondary" name={secondaryLabel} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
