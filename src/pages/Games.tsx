import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Circle } from "lucide-react";

const Games = () => {
  const navigate = useNavigate();

  const games = [
    {
      id: "wheels",
      name: "Roletas",
      description: "Gire a roleta e ganhe prêmios incríveis!",
      icon: Circle,
      route: "/wheels",
    },
    {
      id: "tibiatermo",
      name: "TibiaTermo",
      description: "Descubra a palavra do dia do universo de Tibia!",
      icon: Gamepad2,
      route: "/tibiatermo",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Jogos</h1>
          <p className="text-muted-foreground mb-8">
            Escolha um dos jogos disponíveis e divirta-se!
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {games.map((game) => {
              const IconComponent = game.icon;
              return (
                <Card
                  key={game.id}
                  className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-card border-border"
                  onClick={() => navigate(game.route)}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <IconComponent className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold mb-2 text-card-foreground">
                        {game.name}
                      </h2>
                      <p className="text-muted-foreground">{game.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Games;