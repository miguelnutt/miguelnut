import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Text,
  Flex,
  Select,
  Input,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Stack,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  IconButton,
  useToast,
} from '@chakra-ui/react';
import { SearchIcon, DownloadIcon, RepeatIcon } from '@chakra-ui/icons';

// Tipos
interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  userId?: string;
  username?: string;
}

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
}

// Dados simulados
const mockLogs: LogEntry[] = [
  {
    id: '1',
    timestamp: '2023-06-15T15:30:45',
    level: 'info',
    source: 'auth',
    message: 'Usuário logado com sucesso',
    userId: '1',
    username: 'admin'
  },
  {
    id: '2',
    timestamp: '2023-06-15T15:25:12',
    level: 'warning',
    source: 'payment',
    message: 'Tentativa de pagamento falhou - retry automático',
    userId: '3',
    username: 'user1'
  },
  {
    id: '3',
    timestamp: '2023-06-15T14:50:30',
    level: 'error',
    source: 'api',
    message: 'Erro na chamada de API externa - timeout',
    userId: undefined,
    username: undefined
  },
  {
    id: '4',
    timestamp: '2023-06-15T14:30:22',
    level: 'info',
    source: 'system',
    message: 'Backup automático concluído com sucesso',
    userId: undefined,
    username: undefined
  },
  {
    id: '5',
    timestamp: '2023-06-15T13:45:10',
    level: 'critical',
    source: 'database',
    message: 'Falha na conexão com o banco de dados - tentando reconectar',
    userId: undefined,
    username: undefined
  },
  {
    id: '6',
    timestamp: '2023-06-15T13:20:05',
    level: 'info',
    source: 'auth',
    message: 'Usuário criou nova conta',
    userId: '6',
    username: 'newuser123'
  },
  {
    id: '7',
    timestamp: '2023-06-15T12:15:30',
    level: 'warning',
    source: 'security',
    message: 'Múltiplas tentativas de login malsucedidas',
    userId: undefined,
    username: 'unknown'
  }
];

const mockMetrics: SystemMetric[] = [
  {
    name: 'CPU',
    value: 42,
    unit: '%',
    status: 'healthy'
  },
  {
    name: 'Memória',
    value: 68,
    unit: '%',
    status: 'warning'
  },
  {
    name: 'Disco',
    value: 85,
    unit: '%',
    status: 'warning'
  },
  {
    name: 'Latência API',
    value: 120,
    unit: 'ms',
    status: 'healthy'
  },
  {
    name: 'Erros/min',
    value: 0.5,
    unit: '',
    status: 'healthy'
  }
];

const LogsMonitoring: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toast = useToast();

  // Carregar dados simulados
  useEffect(() => {
    // Em um ambiente real, isso seria uma chamada de API
    setLogs(mockLogs);
    setMetrics(mockMetrics);
  }, []);

  // Filtrar logs
  const filteredLogs = logs.filter(log => {
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    const matchesSource = filterSource === 'all' || log.source === filterSource;
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (log.username && log.username.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesLevel && matchesSource && matchesSearch;
  });

  // Obter fontes únicas para o filtro
  const uniqueSources = Array.from(new Set(logs.map(log => log.source)));

  // Simular atualização de dados
  const handleRefresh = () => {
    setIsRefreshing(true);
    
    // Simular chamada de API
    setTimeout(() => {
      // Atualizar métricas com valores ligeiramente diferentes
      const updatedMetrics = metrics.map(metric => ({
        ...metric,
        value: Math.max(0, Math.min(100, metric.value + (Math.random() * 10 - 5))),
        status: Math.random() > 0.8 ? 
          (Math.random() > 0.5 ? 'warning' : 'healthy') : 
          metric.status
      }));
      
      // Adicionar um novo log
      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: Math.random() > 0.7 ? 'warning' : 'info',
        source: uniqueSources[Math.floor(Math.random() * uniqueSources.length)],
        message: 'Atualização de sistema - verificação de rotina',
      };
      
      setMetrics(updatedMetrics);
      setLogs([newLog, ...logs]);
      setIsRefreshing(false);
      
      toast({
        title: 'Dados atualizados',
        description: 'Logs e métricas do sistema foram atualizados.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    }, 1000);
  };

  // Renderizar badge de nível de log
  const renderLevelBadge = (level: string) => {
    switch (level) {
      case 'info':
        return <Badge colorScheme="blue">Info</Badge>;
      case 'warning':
        return <Badge colorScheme="yellow">Aviso</Badge>;
      case 'error':
        return <Badge colorScheme="orange">Erro</Badge>;
      case 'critical':
        return <Badge colorScheme="red">Crítico</Badge>;
      default:
        return <Badge>Desconhecido</Badge>;
    }
  };

  // Renderizar status de métrica
  const getMetricColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'green.500';
      case 'warning':
        return 'yellow.500';
      case 'critical':
        return 'red.500';
      default:
        return 'gray.500';
    }
  };

  return (
    <Box p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="lg">Logs e Monitoramento</Heading>
        <Button 
          leftIcon={<RepeatIcon />} 
          colorScheme="blue" 
          onClick={handleRefresh}
          isLoading={isRefreshing}
          loadingText="Atualizando"
        >
          Atualizar
        </Button>
      </Flex>

      {/* Métricas do Sistema */}
      <Heading size="md" mb={4}>Métricas do Sistema</Heading>
      <SimpleGrid columns={{ base: 1, md: 3, lg: 5 }} spacing={4} mb={8}>
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardBody>
              <Stat>
                <StatLabel>{metric.name}</StatLabel>
                <StatNumber color={getMetricColor(metric.status)}>
                  {metric.value}{metric.unit}
                </StatNumber>
                <StatHelpText>
                  Status: {metric.status === 'healthy' ? 'Saudável' : 
                          metric.status === 'warning' ? 'Atenção' : 'Crítico'}
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* Filtros de Log */}
      <Heading size="md" mb={4}>Logs do Sistema</Heading>
      <Stack direction={["column", "row"]} spacing={4} mb={6}>
        <Box flex={1}>
          <Flex>
            <Input 
              placeholder="Buscar nos logs" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              mr={2}
            />
            <IconButton 
              aria-label="Buscar logs" 
              icon={<SearchIcon />} 
              colorScheme="blue"
            />
          </Flex>
        </Box>
        
        <Select 
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          maxW="200px"
        >
          <option value="all">Todos os Níveis</option>
          <option value="info">Info</option>
          <option value="warning">Aviso</option>
          <option value="error">Erro</option>
          <option value="critical">Crítico</option>
        </Select>
        
        <Select 
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          maxW="200px"
        >
          <option value="all">Todas as Fontes</option>
          {uniqueSources.map((source, index) => (
            <option key={index} value={source}>{source}</option>
          ))}
        </Select>
        
        <IconButton 
          aria-label="Exportar logs" 
          icon={<DownloadIcon />} 
          colorScheme="green"
          onClick={() => {
            toast({
              title: 'Exportação iniciada',
              description: 'Os logs estão sendo exportados para CSV.',
              status: 'info',
              duration: 3000,
              isClosable: true,
            });
          }}
        />
      </Stack>

      {/* Tabela de Logs */}
      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Timestamp</Th>
              <Th>Nível</Th>
              <Th>Fonte</Th>
              <Th>Mensagem</Th>
              <Th>Usuário</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredLogs.map(log => (
              <Tr key={log.id}>
                <Td>{new Date(log.timestamp).toLocaleString()}</Td>
                <Td>{renderLevelBadge(log.level)}</Td>
                <Td>{log.source}</Td>
                <Td>{log.message}</Td>
                <Td>{log.username || '-'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
};

export default LogsMonitoring;