import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Card,
  CardBody,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Input,
  FormControl,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  Select,
  Stack,
} from '@chakra-ui/react';
import { AddIcon, RepeatIcon } from '@chakra-ui/icons';

// Tipos
interface Transaction {
  id: string;
  userId: string;
  username: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  timestamp: string;
}

interface EconomyStats {
  totalCoins: number;
  activeUsers: number;
  avgCoinsPerUser: number;
  transactionsToday: number;
  coinsDistributedToday: number;
}

// Dados simulados
const mockTransactions: Transaction[] = [
  {
    id: '1',
    userId: '1',
    username: 'admin',
    type: 'credit',
    amount: 500,
    reason: 'Premiação por conteúdo',
    timestamp: '2023-06-15T14:30:00'
  },
  {
    id: '2',
    userId: '2',
    username: 'moderator1',
    type: 'credit',
    amount: 250,
    reason: 'Bônus de moderação',
    timestamp: '2023-06-15T12:15:00'
  },
  {
    id: '3',
    userId: '3',
    username: 'user1',
    type: 'debit',
    amount: 100,
    reason: 'Compra de item na loja',
    timestamp: '2023-06-14T18:45:00'
  },
  {
    id: '4',
    userId: '4',
    username: 'user2',
    type: 'credit',
    amount: 150,
    reason: 'Participação em evento',
    timestamp: '2023-06-14T10:30:00'
  },
  {
    id: '5',
    userId: '5',
    username: 'user3',
    type: 'debit',
    amount: 75,
    reason: 'Troca por recompensa',
    timestamp: '2023-06-13T16:20:00'
  }
];

const mockStats: EconomyStats = {
  totalCoins: 8550,
  activeUsers: 120,
  avgCoinsPerUser: 71.25,
  transactionsToday: 12,
  coinsDistributedToday: 750
};

const EconomyManagement: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<EconomyStats | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    username: '',
    type: 'credit',
    amount: 0,
    reason: ''
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Carregar dados simulados
  useEffect(() => {
    // Em um ambiente real, isso seria uma chamada de API
    setTransactions(mockTransactions);
    setStats(mockStats);
  }, []);

  // Adicionar nova transação
  const handleAddTransaction = () => {
    if (!newTransaction.username || !newTransaction.amount || !newTransaction.reason) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos para continuar.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const transaction: Transaction = {
      id: Date.now().toString(),
      userId: Math.floor(Math.random() * 100).toString(), // Simulado
      username: newTransaction.username,
      type: newTransaction.type as 'credit' | 'debit',
      amount: newTransaction.amount,
      reason: newTransaction.reason,
      timestamp: new Date().toISOString()
    };

    setTransactions([transaction, ...transactions]);
    
    // Atualizar estatísticas
    if (stats) {
      const updatedStats = { ...stats };
      if (transaction.type === 'credit') {
        updatedStats.totalCoins += transaction.amount;
        updatedStats.coinsDistributedToday += transaction.amount;
      } else {
        updatedStats.totalCoins -= transaction.amount;
      }
      updatedStats.transactionsToday += 1;
      setStats(updatedStats);
    }

    toast({
      title: 'Transação adicionada',
      description: `${transaction.amount} Rubini Coins ${transaction.type === 'credit' ? 'adicionados a' : 'removidos de'} ${transaction.username}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });

    // Resetar formulário
    setNewTransaction({
      username: '',
      type: 'credit',
      amount: 0,
      reason: ''
    });
    onClose();
  };

  return (
    <Box p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="lg">Gestão de Economia</Heading>
        <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={onOpen}>
          Nova Transação
        </Button>
      </Flex>

      {/* Estatísticas */}
      {stats && (
        <SimpleGrid columns={{ base: 1, md: 3, lg: 5 }} spacing={4} mb={8}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total de Rubini Coins</StatLabel>
                <StatNumber>{stats.totalCoins.toLocaleString()}</StatNumber>
                <StatHelpText>Em circulação</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Usuários Ativos</StatLabel>
                <StatNumber>{stats.activeUsers}</StatNumber>
                <StatHelpText>Com saldo positivo</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Média por Usuário</StatLabel>
                <StatNumber>{stats.avgCoinsPerUser.toFixed(1)}</StatNumber>
                <StatHelpText>Rubini Coins</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Transações Hoje</StatLabel>
                <StatNumber>{stats.transactionsToday}</StatNumber>
                <StatHelpText>
                  <Flex alignItems="center">
                    <RepeatIcon mr={1} />
                    Atividade
                  </Flex>
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Distribuídos Hoje</StatLabel>
                <StatNumber>{stats.coinsDistributedToday}</StatNumber>
                <StatHelpText>Rubini Coins</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>
      )}

      {/* Histórico de Transações */}
      <Box overflowX="auto">
        <Heading size="md" mb={4}>Histórico de Transações</Heading>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Usuário</Th>
              <Th>Tipo</Th>
              <Th>Quantidade</Th>
              <Th>Motivo</Th>
              <Th>Data/Hora</Th>
            </Tr>
          </Thead>
          <Tbody>
            {transactions.map(transaction => (
              <Tr key={transaction.id}>
                <Td>{transaction.username}</Td>
                <Td>
                  <Badge colorScheme={transaction.type === 'credit' ? 'green' : 'red'}>
                    {transaction.type === 'credit' ? 'Crédito' : 'Débito'}
                  </Badge>
                </Td>
                <Td>{transaction.amount}</Td>
                <Td>{transaction.reason}</Td>
                <Td>{new Date(transaction.timestamp).toLocaleString()}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      {/* Modal de Nova Transação */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nova Transação de Rubini Coins</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Nome de Usuário</FormLabel>
                <Input 
                  placeholder="Digite o nome do usuário"
                  value={newTransaction.username}
                  onChange={(e) => setNewTransaction({...newTransaction, username: e.target.value})}
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Tipo de Transação</FormLabel>
                <Select 
                  value={newTransaction.type}
                  onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value})}
                >
                  <option value="credit">Crédito (Adicionar)</option>
                  <option value="debit">Débito (Remover)</option>
                </Select>
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Quantidade</FormLabel>
                <Input 
                  type="number"
                  placeholder="Quantidade de Rubini Coins"
                  value={newTransaction.amount || ''}
                  onChange={(e) => setNewTransaction({...newTransaction, amount: parseInt(e.target.value) || 0})}
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Motivo</FormLabel>
                <Input 
                  placeholder="Motivo da transação"
                  value={newTransaction.reason}
                  onChange={(e) => setNewTransaction({...newTransaction, reason: e.target.value})}
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancelar
            </Button>
            <Button colorScheme="blue" onClick={handleAddTransaction}>
              Adicionar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default EconomyManagement;