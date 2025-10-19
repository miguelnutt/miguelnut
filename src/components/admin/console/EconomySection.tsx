import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminRubiniCoinsResgates } from "../AdminRubiniCoinsResgates";
import { AdminManageRubiniCoins } from "../AdminManageRubiniCoins";
import { AdminRubiniCoinsHistory } from "../AdminRubiniCoinsHistory";

export function EconomySection() {
  return (
    <Tabs defaultValue="resgates" className="w-full">
      <TabsList className="grid w-full md:w-auto grid-cols-3">
        <TabsTrigger value="resgates">Resgates</TabsTrigger>
        <TabsTrigger value="gerenciar">Gerenciar Saldos</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="resgates" className="space-y-4">
        <AdminRubiniCoinsResgates />
      </TabsContent>

      <TabsContent value="gerenciar" className="space-y-4">
        <AdminManageRubiniCoins />
      </TabsContent>

      <TabsContent value="historico" className="space-y-4">
        <AdminRubiniCoinsHistory />
      </TabsContent>
    </Tabs>
  );
}
