import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const TibiaDle = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState<any>(null);
  const [currentGuess, setCurrentGuess] = useState("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("Você precisa estar logado para jogar!");
      navigate("/login");
      return;
    }

    setUser(user);
    await loadGame(user);
  };

  const loadGame = async (user: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-tibiadle-word', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      setGameData(data);
      setGuesses(data.tentativas || []);
      
      if (data.acertou !== null) {
        setGameOver(true);
        setWon(data.acertou);
      }
    } catch (error: any) {
      console.error('Error loading game:', error);
      toast.error(error.message || "Erro ao carregar jogo");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (key: string) => {
    if (gameOver || submitting) return;

    if (key === "ENTER") {
      submitGuess();
    } else if (key === "BACKSPACE") {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < (gameData?.palavra.length || 8)) {
      setCurrentGuess(prev => prev + key);
    }
  };

  const submitGuess = async () => {
    if (!currentGuess || currentGuess.length !== gameData.palavra.length) {
      toast.error(`A palavra deve ter ${gameData.palavra.length} letras`);
      return;
    }

    if (guesses.includes(currentGuess)) {
      toast.error("Você já tentou essa palavra!");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('submit-tibiadle-guess', {
        body: { 
          tentativa: currentGuess,
          jogo_id: gameData.jogo_id,
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      setGuesses(data.tentativas);
      setCurrentGuess("");

      if (data.jogo_finalizado) {
        setGameOver(true);
        setWon(data.acertou);

        if (data.acertou) {
          let message = `Parabéns! Você acertou em ${data.num_tentativas} tentativa${data.num_tentativas > 1 ? 's' : ''}!`;
          if (data.premiacao_pontos > 0) {
            message += ` +${data.premiacao_pontos} Pontos de Loja`;
          }
          if (data.premiacao_tickets > 0) {
            message += ` +${data.premiacao_tickets} Ticket`;
          }
          toast.success(message);
        } else {
          toast.error(`Você não acertou. A palavra era: ${data.palavra}`);
        }
      }
    } catch (error: any) {
      console.error('Error submitting guess:', error);
      toast.error(error.message || "Erro ao enviar tentativa");
    } finally {
      setSubmitting(false);
    }
  };

  const getLetterColor = (guess: string, letterIndex: number) => {
    if (!gameData) return "bg-muted";
    
    const letter = guess[letterIndex];
    const targetWord = gameData.palavra;

    if (targetWord[letterIndex] === letter) {
      return "bg-green-500 text-white";
    } else if (targetWord.includes(letter)) {
      return "bg-yellow-500 text-white";
    } else {
      return "bg-gray-500 text-white";
    }
  };

  const keyboard = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const maxLength = gameData?.palavra.length || 8;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-center text-foreground">TibiaDle</h1>
          <p className="text-muted-foreground text-center mb-8">
            Descubra a palavra do dia em até 6 tentativas!
          </p>

          <Card className="p-6 mb-6 bg-card">
            <div className="flex flex-col gap-2 mb-6">
              {[...Array(6)].map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-2 justify-center">
                  {[...Array(maxLength)].map((_, colIndex) => {
                    const guess = guesses[rowIndex];
                    const isCurrentRow = rowIndex === guesses.length && !gameOver;
                    const letter = isCurrentRow 
                      ? currentGuess[colIndex] || ""
                      : guess?.[colIndex] || "";

                    return (
                      <div
                        key={colIndex}
                        className={`w-12 h-12 sm:w-14 sm:h-14 border-2 flex items-center justify-center text-xl font-bold uppercase transition-all ${
                          guess
                            ? getLetterColor(guess, colIndex)
                            : isCurrentRow && letter
                            ? "border-primary bg-primary/10"
                            : "border-border"
                        }`}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {gameOver && (
              <div className="text-center mb-6">
                {won ? (
                  <div className="text-green-500 text-xl font-bold">
                    🎉 Parabéns! Você acertou! 🎉
                  </div>
                ) : (
                  <div>
                    <div className="text-red-500 text-xl font-bold mb-2">
                      Não foi dessa vez! 😢
                    </div>
                    <div className="text-muted-foreground">
                      A palavra era: <span className="font-bold text-foreground">{gameData.palavra}</span>
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  Nova palavra disponível amanhã!
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {keyboard.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-1 justify-center">
                  {row.map((key) => (
                    <Button
                      key={key}
                      variant="outline"
                      size={key.length > 1 ? "sm" : "icon"}
                      className="text-xs sm:text-sm font-bold"
                      onClick={() => handleKeyPress(key)}
                      disabled={gameOver || submitting}
                    >
                      {key === "BACKSPACE" ? "⌫" : key}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">🟩 = Letra correta na posição certa</p>
            <p className="mb-2">🟨 = Letra correta na posição errada</p>
            <p>⬜ = Letra não está na palavra</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TibiaDle;