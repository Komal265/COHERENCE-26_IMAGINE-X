import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, Database, Search, Filter, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import Papa from "papaparse";
import { fetchLeads, insertLeads } from "@/lib/supabase-queries";

type LeadStatus = "uploaded" | "clustered" | "message_generated" | "waiting_delay" | "email_sent" | "replied";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  industry: string | null;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  uploaded: "bg-muted text-muted-foreground",
  clustered: "bg-primary/10 text-primary",
  message_generated: "bg-warning/10 text-warning",
  waiting_delay: "bg-blue-100 text-blue-700",
  email_sent: "bg-blue-100 text-blue-700",
  replied: "bg-success/10 text-success",
};

const statusLabels: Record<string, string> = {
  uploaded: "Uploaded",
  clustered: "Clustered",
  message_generated: "Msg Generated",
  waiting_delay: "Waiting",
  email_sent: "Email Sent",
  replied: "Replied",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ count: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);

  const loadLeads = useCallback(async () => {
    try {
      const data = await fetchLeads();
      setLeads(data as Lead[]);
    } catch (err) {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);
    setParticles(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 200 - 100,
        y: Math.random() * 200 - 100,
      }))
    );

    try {
      const text = await file.text();
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });

      if (result.errors.length > 0) {
        toast.error("CSV parsing error: " + result.errors[0].message);
        setUploading(false);
        setParticles([]);
        return;
      }

      const rows = result.data as Record<string, string>[];
      
      // Map CSV columns (case-insensitive)
      const leadsToInsert = rows
        .map((row) => {
          const mapped: Record<string, string> = {};
          Object.entries(row).forEach(([key, val]) => {
            mapped[key.toLowerCase().trim()] = val?.trim() || "";
          });
          return {
            name: mapped.name || mapped.full_name || mapped.fullname || "",
            email: mapped.email || mapped.email_address || "",
            company: mapped.company || mapped.organization || undefined,
            industry: mapped.industry || mapped.sector || undefined,
            role: mapped.role || mapped.title || mapped.position || mapped.job_title || undefined,
          };
        })
        .filter((l) => l.name && l.email);

      if (leadsToInsert.length === 0) {
        toast.error("No valid leads found. Ensure CSV has 'name' and 'email' columns.");
        setUploading(false);
        setParticles([]);
        return;
      }

      await insertLeads(leadsToInsert);
      
      // Wait for particle animation
      await new Promise((r) => setTimeout(r, 2000));
      
      setUploadResult({ count: leadsToInsert.length });
      setParticles([]);
      setUploading(false);
      toast.success(`${leadsToInsert.length} leads imported successfully!`);
      loadLeads();
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message || "Unknown error"));
      setUploading(false);
      setParticles([]);
    }
  }, [loadLeads]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
  });

  const filtered = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.company || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Leads Import</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload CSV files to import your leads</p>
      </div>

      {/* Upload Zone */}
      <Card className="rounded-xl border-dashed border-2 overflow-hidden">
        <div
          {...getRootProps()}
          className={`relative p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? "bg-primary/5" : "bg-card hover:bg-accent/30"
          }`}
        >
          <input {...getInputProps()} />
          <AnimatePresence mode="wait">
            {uploading ? (
              <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex flex-col items-center">
                <motion.div animate={{ scale: [1, 0.8, 0], opacity: [1, 0.6, 0] }} transition={{ duration: 1.5 }}>
                  <FileSpreadsheet className="h-16 w-16 text-primary" />
                </motion.div>
                {particles.map((p) => (
                  <motion.div key={p.id} className="absolute h-2 w-2 rounded-full bg-primary"
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: [p.x * 0.5, p.x, 0], y: [p.y * 0.5, p.y, 80], opacity: [1, 0.8, 0], scale: [1, 0.6, 0.2] }}
                    transition={{ duration: 2, delay: 0.3 + p.id * 0.05 }}
                  />
                ))}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="mt-8">
                  <Database className="h-12 w-12 text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Importing leads...</p>
                </motion.div>
              </motion.div>
            ) : uploadResult ? (
              <motion.div key="uploaded" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
                <CheckCircle2 className="h-12 w-12 text-success" />
                <p className="mt-3 text-sm font-medium text-foreground">{uploadResult.count} leads imported successfully!</p>
                <p className="text-xs text-muted-foreground mt-1">Drop another file to add more</p>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {isDragActive ? "Drop your file here" : "Drag & drop CSV file"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse · requires name and email columns</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Leads Table */}
      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg font-display">Lead Database</CardTitle>
            <CardDescription>{loading ? "Loading..." : `${filtered.length} leads`}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search leads..." className="pl-9 w-64 h-9 rounded-lg" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No leads yet. Upload a CSV to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead, i) => (
                  <motion.tr key={lead.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.company || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.role || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                    <TableCell>
                      {lead.industry ? (
                        <Badge variant="secondary" className="rounded-md font-normal">{lead.industry}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`rounded-md font-normal border-0 ${statusColors[lead.status] || statusColors.uploaded}`}>
                        {statusLabels[lead.status] || lead.status}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
