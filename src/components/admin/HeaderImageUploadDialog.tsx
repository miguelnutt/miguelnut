import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useHalloweenTheme } from "@/contexts/HalloweenThemeContext";
import { Loader2, Upload, RotateCcw } from "lucide-react";
import profileImageDefault from "@/assets/profile-miguelnut.png";

interface HeaderImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HeaderImageUploadDialog = ({ open, onOpenChange }: HeaderImageUploadDialogProps) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { updateHeaderImage, headerProfileImage } = useHalloweenTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Selecione apenas imagens (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 2MB",
        variant: "destructive",
      });
      return;
    }

    // Criar preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!previewImage) return;

    setLoading(true);
    
    try {
      await updateHeaderImage(previewImage);
      toast({
        title: "Imagem atualizada",
        description: "A imagem do header foi atualizada para todos os usuários",
      });
      onOpenChange(false);
      setPreviewImage(null);
    } catch (error) {
      console.error("Erro ao atualizar imagem:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a imagem",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await updateHeaderImage(profileImageDefault);
      toast({
        title: "Imagem restaurada",
        description: "Imagem padrão restaurada para todos os usuários",
      });
      onOpenChange(false);
      setPreviewImage(null);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível restaurar a imagem",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Imagem do Header</DialogTitle>
          <DialogDescription>
            Atualize a imagem do perfil que aparece no header para todos os usuários
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Preview da Imagem</Label>
            <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/50">
              <img 
                src={previewImage || headerProfileImage} 
                alt="Preview" 
                className="h-20 w-20 rounded-full object-cover ring-2 ring-primary"
              />
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Selecionar Imagem Local
          </Button>

          <p className="text-xs text-muted-foreground">
            • Formatos: JPG, PNG, GIF, WebP<br />
            • Tamanho máximo: 2MB<br />
            • Recomendado: imagem quadrada
          </p>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={loading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar Padrão
            </Button>
            <Button
              onClick={handleUpload}
              disabled={loading || !previewImage}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Imagem
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
