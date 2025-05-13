"use client";

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, LayoutGrid } from 'lucide-react';

interface VisualizationCardProps {
  csvDataUri: string | null;
}

type ParsedCsvRow = Record<string, string | number>;

// Basic CSV to Array of Objects parser
function parseCSV(csvString: string): ParsedCsvRow[] {
  const lines = csvString.trim().split(/\r?\n/);
  if (lines.length < 2) return []; // Needs header and at least one data row

  const headers = lines[0].split(',').map(h => h.trim());
  const dataRows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: ParsedCsvRow = {};
    headers.forEach((header, i) => {
      const value = values[i];
      // Attempt to parse as number if possible
      row[header] = !isNaN(Number(value)) && value !== "" ? Number(value) : value;
    });
    return row;
  });
  return dataRows;
}

export function VisualizationCard({ csvDataUri }: VisualizationCardProps) {
  const [parsedData, setParsedData] = useState<ParsedCsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  useEffect(() => {
    if (csvDataUri) {
      try {
        const base64Data = csvDataUri.substring(csvDataUri.indexOf(',') + 1);
        const decodedData = atob(base64Data); // Note: atob might have issues with non-ASCII chars.
                                              // For robust parsing, FileReader.readAsText would be better.
        const data = parseCSV(decodedData);
        if (data.length > 0) {
          setHeaders(Object.keys(data[0]));
          setParsedData(data);
        } else {
          setHeaders([]);
          setParsedData([]);
        }
      } catch (error) {
        console.error("Error parsing CSV data:", error);
        setHeaders([]);
        setParsedData([]);
      }
    } else {
      setHeaders([]);
      setParsedData([]);
    }
  }, [csvDataUri]);

  const chartData = useMemo(() => {
    if (parsedData.length === 0 || headers.length === 0) return null;

    // Attempt to find the first numerical column for a simple distribution chart
    const numericalColumn = headers.find(header => 
      parsedData.every(row => typeof row[header] === 'number' || (typeof row[header] === 'string' && !isNaN(Number(row[header]))))
    );
    
    if (!numericalColumn) return null;

    // For simplicity, let's try to create a frequency distribution for categorical data or group numerical data.
    // Here, we'll just plot the values of the first 10 rows if it's numerical.
    // A more robust approach would be to calculate frequencies or group into bins.
    
    const dataForChart = parsedData.slice(0, 10).map((row, index) => ({
      name: `Row ${index + 1}`, // Or use a categorical column if available
      [numericalColumn]: Number(row[numericalColumn]) // Ensure it's a number
    }));

    if (dataForChart.every(d => isNaN(d[numericalColumn] as number))) return null;

    return { data: dataForChart, column: numericalColumn };

  }, [parsedData, headers]);


  if (!csvDataUri || parsedData.length === 0) {
    return null; // Don't render the card if no CSV or no data
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="w-6 h-6 text-primary" />
          CSV Data Preview
        </CardTitle>
        <CardDescription>A preview of the uploaded CSV file.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Table Data</h3>
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
                {parsedData.slice(0, 20).map((row, rowIndex) => ( // Preview first 20 rows
                  <TableRow key={rowIndex}>
                    {headers.map((header) => (
                      <TableCell key={`${rowIndex}-${header}`}>{String(row[header])}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {chartData && chartData.data.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Column Distribution (Sample)
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Displaying values for column: <strong>{chartData.column}</strong> (first 10 rows).
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <Legend />
                <Bar dataKey={chartData.column} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
