import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const TibiaDleWordsSection = () => {
  const [words, setWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState("");
  const [bulkWords, setBulkWords] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    try {
      const { data, error } = await supabase
        .from("tibiadle_words")
        .select("*")
        .order("palavra");

      if (error) throw error;
      setWords(data || []);
    } catch (error: any) {
      console.error("Error loading words:", error);
      toast.error("Erro ao carregar palavras");
    } finally {
      setLoading(false);
    }
  };

  const validateWord = (word: string) => {
    const cleaned = word.trim().toUpperCase();
    if (cleaned.length < 4 || cleaned.length > 8) {
      return null;
    }
    if (!/^[A-Z]+$/.test(cleaned)) {
      return null;
    }
    return cleaned;
  };

  const addWord = async () => {
    const validated = validateWord(newWord);
    if (!validated) {
      toast.error("Palavra inválida (4-8 letras, sem espaços)");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from("tibiadle_words")
        .insert({ palavra: validated, ativa: true });

      if (error) {
        if (error.code === "23505") {
          toast.error("Palavra já existe");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Palavra adicionada!");
      setNewWord("");
      loadWords();
    } catch (error: any) {
      console.error("Error adding word:", error);
      toast.error("Erro ao adicionar palavra");
    } finally {
      setAdding(false);
    }
  };

  const addBulkWords = async () => {
    const lines = bulkWords.split("\n").filter((l) => l.trim());
    const validWords = lines
      .map((l) => validateWord(l))
      .filter((w) => w !== null);

    if (validWords.length === 0) {
      toast.error("Nenhuma palavra válida encontrada");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from("tibiadle_words")
        .insert(validWords.map((palavra) => ({ palavra, ativa: true })));

      if (error) throw error;

      toast.success(`${validWords.length} palavras adicionadas!`);
      setBulkWords("");
      loadWords();
    } catch (error: any) {
      console.error("Error adding bulk words:", error);
      toast.error("Erro ao adicionar palavras");
    } finally {
      setAdding(false);
    }
  };

  const toggleWord = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("tibiadle_words")
        .update({ ativa: !currentState })
        .eq("id", id);

      if (error) throw error;

      toast.success(currentState ? "Palavra desativada" : "Palavra ativada");
      loadWords();
    } catch (error: any) {
      console.error("Error toggling word:", error);
      toast.error("Erro ao atualizar palavra");
    }
  };

  const deleteWord = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta palavra?")) return;

    try {
      const { error } = await supabase
        .from("tibiadle_words")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Palavra excluída!");
      loadWords();
    } catch (error: any) {
      console.error("Error deleting word:", error);
      toast.error("Erro ao excluir palavra");
    }
  };

  const activeCount = words.filter((w) => w.ativa).length;
  const inactiveCount = words.length - activeCount;

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">TibiaDle — Palavras</h2>
      
      <div className="mb-6 p-4 bg-muted rounded-lg">
        <div className="flex gap-4 text-sm">
          <div>
            <span className="font-bold">Total:</span> {words.length}
          </div>
          <div>
            <span className="font-bold text-green-600">Ativas:</span> {activeCount}
          </div>
          <div>
            <span className="font-bold text-red-600">Inativas:</span> {inactiveCount}
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex gap-2">
          <Input
            placeholder="Nova palavra (4-8 letras)"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value.toUpperCase())}
            maxLength={8}
          />
          <Button onClick={addWord} disabled={adding}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>

        <div>
          <Textarea
            placeholder="Adicionar várias palavras (uma por linha)"
            value={bulkWords}
            onChange={(e) => setBulkWords(e.target.value.toUpperCase())}
            rows={4}
          />
          <Button onClick={addBulkWords} disabled={adding} className="mt-2">
            Adicionar em Lote
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Palavra</TableHead>
              <TableHead className="text-center">Ativa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {words.map((word) => (
              <TableRow key={word.id}>
                <TableCell className="font-mono font-bold">
                  {word.palavra}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={word.ativa}
                    onCheckedChange={() => toggleWord(word.id, word.ativa)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteWord(word.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};