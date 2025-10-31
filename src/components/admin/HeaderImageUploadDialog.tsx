import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useHalloweenTheme } from "@/contexts/HalloweenThemeContext";
import { Loader2, Upload, Link as LinkIcon } from "lucide-react";

interface HeaderImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HeaderImageUploadDialog = ({ open, onOpenChange }: HeaderImageUploadDialogProps) => {
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { updateHeaderImage, headerProfileImage } = useHalloweenTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!imageUrl.trim()) {
      toast({
        title: "URL vazia",
        description: "Por favor, insira uma URL de imagem válida",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      await updateHeaderImage(imageUrl);
      toast({
        title: "Imagem atualizada",
        description: "A imagem do header foi atualizada para todos os usuários",
      });
      onOpenChange(false);
      setImageUrl("");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Imagem do Header</DialogTitle>
          <DialogDescription>
            Atualize a imagem do perfil que aparece no header para todos os usuários
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="imageUrl">URL da Imagem</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="imageUrl"
                  type="url"
                  placeholder="https://exemplo.com/imagem.png"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole a URL de uma imagem hospedada online
            </p>
          </div>

          {imageUrl && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/50">
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-primary"
                  onError={(e) => {
                    e.currentTarget.src = headerProfileImage;
                    toast({
                      title: "Erro ao carregar imagem",
                      description: "A URL fornecida não é uma imagem válida",
                      variant: "destructive",
                    });
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !imageUrl.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Upload className="mr-2 h-4 w-4" />
              Atualizar Imagem
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
