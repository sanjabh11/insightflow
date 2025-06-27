"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BarChart3, LayoutGrid, Sigma, ListTree, Percent } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface VisualizationCardProps {
  csvDataUri: string | null;
}

type ParsedCsvRow = Record<string, string | number | null>;

interface ColumnStats {
  name: string;
  type: "numerical" | "categorical";
  missing: number;
  total: number;
  numericalStats?: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
  };
  categoricalStats?: {
    uniqueCount: number;
    topValues: { value: string; count: number; percentage: number }[];
  };
  distributionData?: { name: string; value: number }[];
}

function parseCSV(csvString: string): ParsedCsvRow[] {
  const lines = csvString.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const dataRows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: ParsedCsvRow = {};
    headers.forEach((header, i) => {
      const value = values[i];
      row[header] =
        value === "" || value === null || value === undefined
          ? null
          : !isNaN(Number(value))
            ? Number(value)
            : value;
    });
    return row;
  });
  return dataRows;
}

function analyzeColumn(data: ParsedCsvRow[], header: string): ColumnStats {
  const values = data.map((row) => row[header]);
  const validValues = values.filter(
    (v) => v !== null && v !== undefined && String(v).trim() !== "",
  );
  const missing = values.length - validValues.length;

  const numbers = validValues
    .map((v) => String(v))
    .map(Number)
    .filter((n) => !isNaN(n));

  if (validValues.length > 0 && numbers.length / validValues.length > 0.7) {
    // Heuristic: if 70% are numbers, treat as numerical
    numbers.sort((a, b) => a - b);
    const sum = numbers.reduce((acc, n) => acc + n, 0);
    const mean = numbers.length > 0 ? sum / numbers.length : 0;

    let median = 0;
    let q1 = 0;
    let q3 = 0;
    if (numbers.length > 0) {
      const mid = Math.floor(numbers.length / 2);
      median =
        numbers.length % 2 !== 0
          ? numbers[mid]
          : (numbers[mid - 1] + numbers[mid]) / 2;

      const lowerHalf = numbers.slice(0, numbers.length % 2 !== 0 ? mid : mid);
      const upperHalf = numbers.slice(numbers.length % 2 !== 0 ? mid + 1 : mid);

      if (lowerHalf.length > 0) {
        const q1Mid = Math.floor(lowerHalf.length / 2);
        q1 =
          lowerHalf.length % 2 !== 0
            ? lowerHalf[q1Mid]
            : (lowerHalf[q1Mid - 1] + lowerHalf[q1Mid]) / 2;
      }
      if (upperHalf.length > 0) {
        const q3Mid = Math.floor(upperHalf.length / 2);
        q3 =
          upperHalf.length % 2 !== 0
            ? upperHalf[q3Mid]
            : (upperHalf[q3Mid - 1] + upperHalf[q3Mid]) / 2;
      }
    }

    const min = numbers[0] ?? 0;
    const max = numbers[numbers.length - 1] ?? 0;
    const variance =
      numbers.length > 1
        ? numbers.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) /
          (numbers.length - 1)
        : 0;
    const stdDev = Math.sqrt(variance);

    // Histogram data
    const numBins = Math.min(
      10,
      Math.max(3, Math.floor(Math.sqrt(numbers.length))),
    );
    let distributionData: { name: string; value: number }[] = [];
    if (numbers.length > 0 && min !== max) {
      const binSize = (max - min) / numBins;
      const bins = Array(numBins)
        .fill(0)
        .map((_, i) => ({
          name: `${(min + i * binSize).toFixed(1)}-${(min + (i + 1) * binSize).toFixed(1)}`,
          value: 0,
        }));
      numbers.forEach((val) => {
        let binIndex = Math.floor((val - min) / binSize);
        if (val === max)
          binIndex = numBins - 1; // Ensure max value is in the last bin
        else binIndex = Math.max(0, Math.min(binIndex, numBins - 1));
        if (bins[binIndex]) bins[binIndex].value++;
      });
      distributionData = bins;
    } else if (numbers.length > 0) {
      // All values are the same
      distributionData = [{ name: String(min), value: numbers.length }];
    }

    return {
      name: header,
      type: "numerical",
      missing,
      total: values.length,
      numericalStats: { mean, median, stdDev, min, max, q1, q3 },
      distributionData,
    };
  } else {
    // Treat as categorical
    const counts: Record<string, number> = {};
    validValues.forEach((v) => {
      const valStr = String(v);
      counts[valStr] = (counts[valStr] || 0) + 1;
    });
    const sortedCounts = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([value, count]) => ({
        value,
        count,
        percentage:
          validValues.length > 0 ? (count / validValues.length) * 100 : 0,
      }));

    return {
      name: header,
      type: "categorical",
      missing,
      total: values.length,
      categoricalStats: {
        uniqueCount: sortedCounts.length,
        topValues: sortedCounts.slice(0, 10), // Top 10 values
      },
      distributionData: sortedCounts
        .slice(0, 10)
        .map((d) => ({ name: d.value, value: d.count })),
    };
  }
}

function calculateCorrelationMatrix(
  data: ParsedCsvRow[],
  numericalColumns: string[],
): Record<string, Record<string, number | string>> {
  const matrix: Record<string, Record<string, number | string>> = {};
  if (numericalColumns.length < 2) return matrix;

  const getColumnValues = (colName: string): (number | null)[] =>
    data.map((row) => {
      const val = row[colName];
      return typeof val === "number" && !isNaN(val) ? val : null;
    });

  function pearsonCorrelation(
    xVals: (number | null)[],
    yVals: (number | null)[],
  ): number {
    const validPairs = xVals
      .map((x, i) => [x, yVals[i]])
      .filter(
        ([x, y]) =>
          x !== null && y !== null && x !== undefined && y !== undefined,
      ) as [number, number][];
    if (validPairs.length < 2) return NaN; // Not enough data points

    const n = validPairs.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0,
      sumY2 = 0;
    validPairs.forEach(([x, y]) => {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    });

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );
    return den === 0 ? 0 : num / den;
  }

  numericalColumns.forEach((col1) => {
    matrix[col1] = {};
    numericalColumns.forEach((col2) => {
      if (col1 === col2) {
        matrix[col1][col2] = 1.0;
      } else if (matrix[col2] && matrix[col2][col1] !== undefined) {
        matrix[col1][col2] = matrix[col2][col1];
      } else {
        const values1 = getColumnValues(col1);
        const values2 = getColumnValues(col2);
        const corr = pearsonCorrelation(values1, values2);
        matrix[col1][col2] = isNaN(corr) ? "N/A" : parseFloat(corr.toFixed(3));
      }
    });
  });
  return matrix;
}

const PIE_COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82Ca9D",
  "#A4De6C",
  "#D0Ed57",
  "#FF7F50",
  "#6495ED",
];

export function VisualizationCard({ csvDataUri }: VisualizationCardProps) {
  const [parsedData, setParsedData] = useState<ParsedCsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnAnalyses, setColumnAnalyses] = useState<ColumnStats[]>([]);
  const [correlationMatrix, setCorrelationMatrix] = useState<
    Record<string, Record<string, number | string>>
  >({});
  const [selectedColumnForViz, setSelectedColumnForViz] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (csvDataUri) {
      try {
        const base64Data = csvDataUri.substring(csvDataUri.indexOf(",") + 1);
        const decodedData = atob(base64Data);
        const data = parseCSV(decodedData);
        if (data.length > 0) {
          const currentHeaders = Object.keys(data[0]);
          setHeaders(currentHeaders);
          setParsedData(data);

          const analyses = currentHeaders.map((header) =>
            analyzeColumn(data, header),
          );
          setColumnAnalyses(analyses);
          setSelectedColumnForViz(currentHeaders[0] || null);

          const numericalCols = analyses
            .filter((a) => a.type === "numerical")
            .map((a) => a.name);
          setCorrelationMatrix(calculateCorrelationMatrix(data, numericalCols));
        } else {
          setHeaders([]);
          setParsedData([]);
          setColumnAnalyses([]);
          setCorrelationMatrix({});
          setSelectedColumnForViz(null);
        }
      } catch (error) {
        console.error("Error parsing CSV data:", error);
        setHeaders([]);
        setParsedData([]);
        setColumnAnalyses([]);
        setCorrelationMatrix({});
        setSelectedColumnForViz(null);
      }
    } else {
      setHeaders([]);
      setParsedData([]);
      setColumnAnalyses([]);
      setCorrelationMatrix({});
      setSelectedColumnForViz(null);
    }
  }, [csvDataUri]);

  const selectedColumnAnalysis = useMemo(() => {
    return columnAnalyses.find((col) => col.name === selectedColumnForViz);
  }, [columnAnalyses, selectedColumnForViz]);

  const numericalHeaders = useMemo(
    () =>
      headers.filter((h) =>
        columnAnalyses.find((ca) => ca.name === h && ca.type === "numerical"),
      ),
    [headers, columnAnalyses],
  );

  if (!csvDataUri || parsedData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="w-6 h-6 text-primary" />
          Exploratory Data Analysis (EDA)
        </CardTitle>
        <CardDescription>
          Interactive preview and analysis of the uploaded CSV file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Accordion
          type="multiple"
          defaultValue={["table-preview", "column-summary"]}
          className="w-full"
        >
          <AccordionItem value="table-preview">
            <AccordionTrigger className="text-lg font-semibold">
              <LayoutGrid className="w-5 h-5 mr-2" /> Table Preview (First 20
              Rows)
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-[300px] w-full border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 20).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {headers.map((header) => (
                          <TableCell key={`${rowIndex}-${header}`}>
                            {String(row[header] ?? "N/A")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="column-summary">
            <AccordionTrigger className="text-lg font-semibold">
              <Sigma className="w-5 h-5 mr-2" /> Column Summaries
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              {columnAnalyses.map((col) => (
                <div
                  key={col.name}
                  className="p-3 border rounded-md bg-secondary/30"
                >
                  <h4 className="font-semibold text-md mb-1">
                    {col.name}{" "}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                      {col.type}
                    </span>
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Total: {col.total}, Missing: {col.missing} (
                    {col.total > 0
                      ? ((col.missing / col.total) * 100).toFixed(1)
                      : 0}
                    %)
                  </p>
                  {col.type === "numerical" && col.numericalStats && (
                    <ul className="text-xs mt-1 space-y-0.5">
                      <li>
                        Min: {col.numericalStats.min.toFixed(2)}, Max:{" "}
                        {col.numericalStats.max.toFixed(2)}
                      </li>
                      <li>
                        Mean: {col.numericalStats.mean.toFixed(2)}, Median:{" "}
                        {col.numericalStats.median.toFixed(2)}
                      </li>
                      <li>Std Dev: {col.numericalStats.stdDev.toFixed(2)}</li>
                      <li>
                        Q1: {col.numericalStats.q1.toFixed(2)}, Q3:{" "}
                        {col.numericalStats.q3.toFixed(2)}
                      </li>
                    </ul>
                  )}
                  {col.type === "categorical" && col.categoricalStats && (
                    <ul className="text-xs mt-1 space-y-0.5">
                      <li>Unique Values: {col.categoricalStats.uniqueCount}</li>
                      <li className="font-medium pt-0.5">Top Values:</li>
                      {col.categoricalStats.topValues.slice(0, 3).map((tv) => (
                        <li key={tv.value} className="truncate ml-2">
                          {tv.value}: {tv.count} ({tv.percentage.toFixed(1)}%)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="column-distributions">
            <AccordionTrigger className="text-lg font-semibold">
              <BarChart3 className="w-5 h-5 mr-2" /> Column Distributions
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="column-select-dist" className="text-sm">
                  Select Column:
                </Label>
                <Select
                  value={selectedColumnForViz || ""}
                  onValueChange={setSelectedColumnForViz}
                >
                  <SelectTrigger id="column-select-dist" className="w-[200px]">
                    <SelectValue placeholder="Select a column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedColumnAnalysis &&
                selectedColumnAnalysis.distributionData &&
                selectedColumnAnalysis.distributionData.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-md mb-2">
                      Distribution of: {selectedColumnAnalysis.name}
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                      {selectedColumnAnalysis.type === "numerical" ? (
                        <BarChart
                          data={selectedColumnAnalysis.distributionData}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-30}
                            textAnchor="end"
                            height={70}
                            interval={0}
                            tick={{ fontSize: 10 }}
                          />

                          <YAxis allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--background))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: "var(--radius)",
                            }}
                          />

                          <Bar
                            dataKey="value"
                            name="Frequency"
                            fill="hsl(var(--primary))"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      ) : (
                        // Categorical - Pie Chart for top categories
                        <PieChart>
                          <Pie
                            data={selectedColumnAnalysis.distributionData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label
                          >
                            {selectedColumnAnalysis.distributionData.map(
                              (entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                                />
                              ),
                            )}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--background))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: "var(--radius)",
                            }}
                          />

                          <Legend />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              {selectedColumnAnalysis &&
                (!selectedColumnAnalysis.distributionData ||
                  selectedColumnAnalysis.distributionData.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    No distribution data available or all values are
                    unique/missing for {selectedColumnAnalysis.name}.
                  </p>
                )}
            </AccordionContent>
          </AccordionItem>

          {numericalHeaders.length >= 2 && (
            <AccordionItem value="correlation-matrix">
              <AccordionTrigger className="text-lg font-semibold">
                <Percent className="w-5 h-5 mr-2" /> Correlation Matrix
                (Numerical Columns)
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground mb-2">
                  Pearson correlation coefficients. Values range from -1
                  (perfect negative) to 1 (perfect positive). 0 indicates no
                  linear correlation.
                </p>
                <ScrollArea className="max-h-[400px] w-full border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-card z-10">
                          Column
                        </TableHead>
                        {numericalHeaders.map((h) => (
                          <TableHead key={h}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {numericalHeaders.map((rowHeader) => (
                        <TableRow key={rowHeader}>
                          <TableHead className="sticky left-0 bg-card z-10">
                            {rowHeader}
                          </TableHead>
                          {numericalHeaders.map((colHeader) => {
                            const val =
                              correlationMatrix[rowHeader]?.[colHeader];
                            let bgColor = "transparent";
                            if (typeof val === "number") {
                              if (val > 0.7 || val < -0.7)
                                bgColor = "hsl(var(--primary) / 0.3)";
                              else if (val > 0.4 || val < -0.4)
                                bgColor = "hsl(var(--primary) / 0.15)";
                            }
                            return (
                              <TableCell
                                key={`${rowHeader}-${colHeader}`}
                                style={{ backgroundColor: bgColor }}
                              >
                                {val !== undefined ? String(val) : "N/A"}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
