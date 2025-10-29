import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Input,
  Select,
  Stack,
  Heading,
  Text,
  useToast,
  Badge,
  Flex,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';

// Tipo de usuário simulado
interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'moderator' | 'user';
  status: 'active' | 'suspended' | 'banned';
  lastLogin: string;
  rubiniCoins: number;
}

// Dados simulados
const mockUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    lastLogin: '2023-06-15T10:30:00',
    rubiniCoins: 5000
  },
  {
    id: '2',
    username: 'moderator1',
    email: 'mod1@example.com',
    role: 'moderator',
    status: 'active',
    lastLogin: '2023-06-14T14:20:00',
    rubiniCoins: 2500
  },
  {
    id: '3',
    username: 'user1',
    email: 'user1@example.com',
    role: 'user',
    status: 'active',
    lastLogin: '2023-06-13T09:15:00',
    rubiniCoins: 750
  },
  {
    id: '4',
    username: 'user2',
    email: 'user2@example.com',
    role: 'user',
    status: 'suspended',
    lastLogin: '2023-06-10T16:45:00',
    rubiniCoins: 300
  },
  {
    id: '5',
    username: 'user3',
    email: 'user3@example.com',
    role: 'user',
    status: 'banned',
    lastLogin: '2023-05-30T11:20:00',
    rubiniCoins: 0
  }
];

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Carregar dados simulados
  useEffect(() => {
    // Em um ambiente real, isso seria uma chamada de API
    setUsers(mockUsers);
  }, []);

  // Filtrar usuários
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Abrir modal de edição
  const handleEditUser = (user: User) => {
    setSelectedUser({...user});
    onOpen();
  };

  // Salvar alterações do usuário
  const handleSaveUser = () => {
    if (selectedUser) {
      setUsers(users.map(user => user.id === selectedUser.id ? selectedUser : user));
      toast({
        title: 'Usuário atualizado',
        description: `As alterações para ${selectedUser.username} foram salvas.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onClose();
    }
  };

  // Alterar status do usuário
  const handleStatusChange = (userId: string, newStatus: 'active' | 'suspended' | 'banned') => {
    setUsers(users.map(user => {
      if (user.id === userId) {
        return { ...user, status: newStatus };
      }
      return user;
    }));
    
    toast({
      title: 'Status alterado',
      description: `O status do usuário foi alterado para ${newStatus}.`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  // Renderizar badge de status
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge colorScheme="green">Ativo</Badge>;
      case 'suspended':
        return <Badge colorScheme="yellow">Suspenso</Badge>;
      case 'banned':
        return <Badge colorScheme="red">Banido</Badge>;
      default:
        return <Badge>Desconhecido</Badge>;
    }
  };

  return (
    <Box p={4}>
      <Heading size="lg" mb={4}>Gestão de Usuários</Heading>
      
      {/* Filtros e busca */}
      <Stack direction={["column", "row"]} spacing={4} mb={6}>
        <Box flex={1}>
          <Flex>
            <Input 
              placeholder="Buscar por nome ou email" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              mr={2}
            />
            <IconButton 
              aria-label="Buscar usuários" 
              icon={<SearchIcon />} 
              colorScheme="blue"
            />
          </Flex>
        </Box>
        
        <Select 
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          maxW="200px"
        >
          <option value="all">Todos os Papéis</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderador</option>
          <option value="user">Usuário</option>
        </Select>
        
        <Select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          maxW="200px"
        >
          <option value="all">Todos os Status</option>
          <option value="active">Ativo</option>
          <option value="suspended">Suspenso</option>
          <option value="banned">Banido</option>
        </Select>
      </Stack>
      
      {/* Tabela de usuários */}
      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Usuário</Th>
              <Th>Email</Th>
              <Th>Papel</Th>
              <Th>Status</Th>
              <Th>Último Login</Th>
              <Th>Rubini Coins</Th>
              <Th>Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredUsers.map(user => (
              <Tr key={user.id}>
                <Td>{user.username}</Td>
                <Td>{user.email}</Td>
                <Td>{user.role === 'admin' ? 'Administrador' : user.role === 'moderator' ? 'Moderador' : 'Usuário'}</Td>
                <Td>{renderStatusBadge(user.status)}</Td>
                <Td>{new Date(user.lastLogin).toLocaleString()}</Td>
                <Td>{user.rubiniCoins}</Td>
                <Td>
                  <Stack direction="row" spacing={2}>
                    <IconButton
                      aria-label="Editar usuário"
                      icon={<EditIcon />}
                      size="sm"
                      colorScheme="blue"
                      onClick={() => handleEditUser(user)}
                    />
                    <Select 
                      size="sm" 
                      width="120px"
                      value={user.status}
                      onChange={(e) => handleStatusChange(user.id, e.target.value as 'active' | 'suspended' | 'banned')}
                    >
                      <option value="active">Ativar</option>
                      <option value="suspended">Suspender</option>
                      <option value="banned">Banir</option>
                    </Select>
                  </Stack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
      
      {/* Modal de edição */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Editar Usuário</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedUser && (
              <Stack spacing={4}>
                <FormControl>
                  <FormLabel>Nome de Usuário</FormLabel>
                  <Input 
                    value={selectedUser.username}
                    onChange={(e) => setSelectedUser({...selectedUser, username: e.target.value})}
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Email</FormLabel>
                  <Input 
                    value={selectedUser.email}
                    onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Papel</FormLabel>
                  <Select 
                    value={selectedUser.role}
                    onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value as 'admin' | 'moderator' | 'user'})}
                  >
                    <option value="admin">Administrador</option>
                    <option value="moderator">Moderador</option>
                    <option value="user">Usuário</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Status</FormLabel>
                  <Select 
                    value={selectedUser.status}
                    onChange={(e) => setSelectedUser({...selectedUser, status: e.target.value as 'active' | 'suspended' | 'banned'})}
                  >
                    <option value="active">Ativo</option>
                    <option value="suspended">Suspenso</option>
                    <option value="banned">Banido</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Rubini Coins</FormLabel>
                  <Input 
                    type="number"
                    value={selectedUser.rubiniCoins}
                    onChange={(e) => setSelectedUser({...selectedUser, rubiniCoins: parseInt(e.target.value) || 0})}
                  />
                </FormControl>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancelar
            </Button>
            <Button colorScheme="blue" onClick={handleSaveUser}>
              Salvar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default UserManagement;