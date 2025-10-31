import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface HeaderImageUploadProps {
  currentImage: string;
  onImageChange: (imageUrl: string) => void;
  onReset: () => void;
}

export const HeaderImageUpload: React.FC<HeaderImageUploadProps> = ({
  currentImage,
  onImageChange,
  onReset
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive"
      });
      return;
    }

    // Criar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!previewImage) return;

    setIsUploading(true);
    try {
      // Salvar a imagem no localStorage
      localStorage.setItem('custom-header-image', previewImage);
      onImageChange(previewImage);
      
      toast({
        title: "Sucesso",
        description: "Imagem do header atualizada com sucesso!",
        variant: "default"
      });
      
      setIsOpen(false);
      setPreviewImage(null);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar a imagem. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem('custom-header-image');
    onReset();
    setPreviewImage(null);
    toast({
      title: "Sucesso",
      description: "Imagem do header restaurada para o padrão.",
      variant: "default"
    });
    setIsOpen(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300"
        >
          <ImageIcon className="h-4 w-4" />
          Editar Imagem
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Imagem do Header</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Preview da imagem atual */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Imagem atual:</p>
            <img
              src={previewImage || currentImage}
              alt="Preview"
              className="h-16 w-16 rounded-full object-cover mx-auto ring-2 ring-gray-300"
            />
          </div>

          {/* Input de arquivo oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Botões de ação */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={triggerFileInput}
              variant="outline"
              className="w-full"
              disabled={isUploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Selecionar Nova Imagem
            </Button>

            {previewImage && (
              <Button
                onClick={handleUpload}
                className="w-full"
                disabled={isUploading}
              >
                {isUploading ? "Salvando..." : "Salvar Imagem"}
              </Button>
            )}

            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/20"
              disabled={isUploading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar Padrão
            </Button>
          </div>

          {/* Informações sobre o upload */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Formatos aceitos: JPG, PNG, GIF, WebP</p>
            <p>• Tamanho máximo: 5MB</p>
            <p>• Recomendado: imagem quadrada (1:1)</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};