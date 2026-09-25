-- BIO CELL - Seed: Dados iniciais
-- Execute no SQL Editor do Supabase DEPOIS da migration.sql

-- Organização
INSERT INTO "Organization" ("id", "name", "createdAt") VALUES
('org_biocell', 'Bio Cell by Vetnil', NOW());

-- Matriz
INSERT INTO "Unit" ("id", "name", "city", "state", "species", "address", "phone", "organizationId", "createdAt") VALUES
('unit_matriz', 'MATRIZ BIO CELL', 'São Paulo', 'SP', 'Cão, gato, equino', 'Matriz Bio Cell – Vetnil', '', 'org_biocell', NOW());

-- 73 UABCs
INSERT INTO "Unit" ("id", "name", "city", "state", "species", "phone", "address", "organizationId", "createdAt") VALUES
('unit_01', 'UABC CLINILAB', 'Salvador', 'BA', 'Cão, gato, equino', '(71) 99185-0075', 'Rua Alto do Girassol, nº 530. Cassange – Salvador', 'org_biocell', NOW()),
('unit_02', 'UABC REGENERAVET', 'Ilhéus', 'BA', 'Cão, gato', '(73) 98200-0698', 'Avenida Lomanto Júnior, 950. Pontal – Ilhéus', 'org_biocell', NOW()),
('unit_03', 'UABC ÁGUAS CLARAS', 'Brasília', 'DF', 'Cão, gato', '(61) 99921-6776', 'Rua 25 Sul, lote 30, bloco A, loja 105 – Águas Claras', 'org_biocell', NOW()),
('unit_04', 'UABC AMPARO', 'Brasília', 'DF', 'Cão, gato', '(61) 3257-8900', 'CLS 111 Bloco C Lj 36 – Asa Sul', 'org_biocell', NOW()),
('unit_05', 'UABC BIO REPRODUÇÃO ANIMAL', 'Brasília', 'DF', 'Equino', '(61) 3382-7407', 'SMPW Quadra 5, conj 5, Lote 1, casa C – Park Way', 'org_biocell', NOW()),
('unit_06', 'UABC CVV', 'Brasília', 'DF', 'Cão, gato', '(61) 98209-5884', 'Condomínio San Diego, etapa 1, rua 1, lote 385 – Jardim Botânico', 'org_biocell', NOW()),
('unit_07', 'UABC GABRIELA GUENKA', 'Brasília', 'DF', 'Equino', '(61) 99963-6167', 'Núcleo Rural Morro da Capelinha, chácara 06 – Planaltina', 'org_biocell', NOW()),
('unit_08', 'UABC STAR VET', 'Brasília', 'DF', 'Cão, gato', '(61) 99693-3018', 'Avenida Pau Brasil, Lote 11, Lojas 4, 5, 6 e 7 – Águas Claras', 'org_biocell', NOW()),
('unit_09', 'UABC EQUUS CENTER', 'Goiânia', 'GO', 'Equino', '(62) 98560-8484', 'Rodovia GO-010. Km 13, Zona Rural – Goiânia', 'org_biocell', NOW()),
('unit_10', 'UABC MEDCÃO', 'Goiânia', 'GO', 'Cão, gato', '(62) 3091-4386', 'Av. Mangalô, Qd 10, Lt 32. Setor Morada do Sol – Goiânia', 'org_biocell', NOW()),
('unit_11', 'UABC CERNITAS', 'São Luís', 'MA', 'Cão, gato', '(98) 3244-3416', 'Avenida Alcino Búlio, 17. Cohab Anil III – São Luís', 'org_biocell', NOW()),
('unit_12', 'UABC CLINIVET', 'Guarantã do Norte', 'MT', 'Cão, gato', '(66) 9611-4330', 'Av. Dante Martins de Oliveira, 1225. Cidade Nova – Guarantã do Norte', 'org_biocell', NOW()),
('unit_13', 'UABC SPA ANIMAL', 'Primavera do Leste', 'MT', 'Cão, gato', '(66) 3498-9552', 'Av. Campo Grande, 1090. Centro – Primavera do Leste', 'org_biocell', NOW()),
('unit_14', 'UABC VET VIDA', 'Cuiabá', 'MT', 'Cão, gato, equino', '(65) 3621-4092', 'Av. Miguel Sutil, 5717. Quilombo – Cuiabá', 'org_biocell', NOW()),
('unit_15', 'UABC DOURADOS', 'Dourados', 'MS', 'Cão, gato', '(67) 99913-9454', 'Rua Olinda Pires de Almeida, 500. Vila Aurora – Dourados', 'org_biocell', NOW()),
('unit_16', 'UABC LABDOC', 'Campo Grande', 'MS', 'Cão, gato, equino', '(67) 99955-4241', 'Avenida Tamandáré, 6000 (HOVET UCDB). Jardim Seminário – Campo Grande', 'org_biocell', NOW()),
('unit_17', 'UABC PATAS E GARRAS', 'Costa Rica', 'MS', 'Cão, gato', '(67) 99908-7429', 'Rua Antonio Bocalan, 90. Centro – Costa Rica', 'org_biocell', NOW()),
('unit_18', 'UABC ZHEN VET', 'Campo Grande', 'MS', 'Cão, gato', '(67) 98402-3581', 'Avenida Mato Grosso, 3745. Santa Fé – Campo Grande', 'org_biocell', NOW()),
('unit_19', 'UA ESCOLA UFU', 'Uberlândia', 'MG', 'Equino', '(19) 98176-5305', 'R. Ceará, 1084. Bloco 2D UFU (Campus Umuarama) – Uberlândia', 'org_biocell', NOW()),
('unit_20', 'UABC DOS VALES', 'Teófilo Otoni', 'MG', 'Cão, gato, equino', '(33) 98825-2582', 'Rua Padre Virgulino, 1036. Centro – Teófilo Otoni', 'org_biocell', NOW()),
('unit_21', 'UABC ESPAÇO PET BH', 'Belo Horizonte', 'MG', 'Cão, gato, equino', '(31) 98550-1400', 'Av. José Candido da Silveira, 631. Cidade Nova – Belo Horizonte', 'org_biocell', NOW()),
('unit_22', 'UABC SÃO FRANCISCO', 'Conselheiro Lafaiete', 'MG', 'Cão, gato', '(31) 3721-1530', 'Rua Duque de Caxias, 352. Chapada – Conselheiro Lafaiete', 'org_biocell', NOW()),
('unit_23', 'UABC VETMASTER', 'Belo Horizonte', 'MG', 'Cão, gato', '(31) 99193-1146', 'Rua Póvoa de Varzim, 480. Paquetá – Belo Horizonte', 'org_biocell', NOW()),
('unit_24', 'UABC AMOR & VET', 'Londrina', 'PR', 'Cão, gato, equino', '(43) 98811-7033', 'Avenida Aminthas de Barros, 475. Ipanema – Londrina', 'org_biocell', NOW()),
('unit_25', 'UABC AUQMIA', 'Bandeirantes', 'PR', 'Cão, gato', '(43) 99128-5309', 'Av. Bandeirantes, 189. Centro – Bandeirantes', 'org_biocell', NOW()),
('unit_26', 'UABC CLINIVET PR', 'Curitiba', 'PR', 'Cão, gato', '(41) 3257-4326', 'Rua Holanda, 894. Boa Vista – Curitiba', 'org_biocell', NOW()),
('unit_27', 'UABC OFTALMOVET', 'Cascavel', 'PR', 'Cão, gato', '(45) 3222-4855', 'Rua Osvaldo Cruz, 2158. Centro – Cascavel', 'org_biocell', NOW()),
('unit_28', 'UABC PRONTO DOG', 'Maringá', 'PR', 'Cão, gato', '(44) 3226-3739', 'Av. São Paulo, 1654. Zona 02 – Maringá', 'org_biocell', NOW()),
('unit_29', 'UABC VETS COM AMOR', 'Pato Branco', 'PR', 'Cão, gato', '(46) 3223-1542', 'Rua Paraná, 588. Centro – Pato Branco', 'org_biocell', NOW()),
('unit_30', 'UABC CEVEPE', 'Petrolina', 'PE', 'Cão, gato, equino', '(87) 3862-3989', 'Rua Engenheiro Carlos Pinheiro, 382. Centro – Petrolina', 'org_biocell', NOW()),
('unit_31', 'UABC HARMONIA', 'Recife', 'PE', 'Cão, gato', '(81) 3126-7555', 'Estrada do Encanamento, 585. Casa Forte – Recife', 'org_biocell', NOW()),
('unit_32', 'UABC UDVET', 'Teresina', 'PI', 'Cão, gato, equino', '(86) 3305-6825', 'Rua Professor Pires Gayoso, 335. São João – Teresina', 'org_biocell', NOW()),
('unit_33', 'UABC ESPECILAB', 'Rio de Janeiro', 'RJ', 'Cão, gato, equino', '(21) 99318-4564', 'Rua Ipiranga, 107. Laranjeiras – Rio de Janeiro', 'org_biocell', NOW()),
('unit_34', 'UABC MUNDO À PARTE NITERÓI', 'Niterói', 'RJ', 'Cão, gato', '(21) 3741-2690', 'Av. Rui Barbosa, 274, Loja 102. São Francisco – Niterói', 'org_biocell', NOW()),
('unit_35', 'UABC DR. ÁLVARO ABREU', 'Canela', 'RS', 'Cão, gato, equino', '(54) 3282-8856', 'Av. Dom Luiz Guanella, 1093. São José – Canela', 'org_biocell', NOW()),
('unit_36', 'UABC HOSPITAL VET URUGUAIANA', 'Uruguaiana', 'RS', 'Cão, gato', '(55) 99960-6070', 'Rua Domingos de Almeida, 2467. Centro – Uruguaiana', 'org_biocell', NOW()),
('unit_37', 'UABC LA VIE LABORATÓRIO', 'Osório', 'RS', 'Cão, gato, equino', '(51) 99986-5258', 'Rua Costa Gama, 855, sala 3. Sulbrasileiro – Osório', 'org_biocell', NOW()),
('unit_38', 'UABC NEFROCELL', 'Porto Alegre', 'RS', 'Cão, gato', '(51) 9567-5645', 'Av. Sertório, 4903. Jardim São Pedro – Porto Alegre', 'org_biocell', NOW()),
('unit_39', 'UABC ORO', 'Erechim', 'RS', 'Cão, gato', '(54) 99625-2661', 'Rua Marechal Floriano, 309. Centro – Erechim', 'org_biocell', NOW()),
('unit_40', 'UABC SOLUTIONS VET', 'Porto Alegre', 'RS', 'Cão, gato', '(51) 99745-6188', 'Rua Quintino Bocaiuva, 715. Moinhos de Vento – Porto Alegre', 'org_biocell', NOW()),
('unit_41', 'UABC SANTA MARIA', 'Ariquemes', 'RO', 'Cão, gato', '(69) 99322-4202', 'Avenida Juscelino Kubitschek, 2302. Setor 04 – Ariquemes', 'org_biocell', NOW()),
('unit_42', 'UABC ADHARAS', 'Itajaí', 'SC', 'Cão, gato', '(47) 98411-9731', 'Av. Sete de Setembro, 1084 – Fazenda, Itajaí/SC', 'org_biocell', NOW()),
('unit_43', 'UABC BICHOS', 'Itajaí', 'SC', 'Cão, gato', '(47) 99918-9042', 'Rua Manoel Aníbal Pereira, 469. Dom Bosco – Itajaí', 'org_biocell', NOW()),
('unit_44', 'UABC MAP PETBLU', 'Blumenau', 'SC', 'Cão, gato', '', '', 'org_biocell', NOW()),
('unit_45', 'UABC SAINT GERMAIN', 'Florianópolis', 'SC', 'Cão, gato', '(48) 99981-4193', 'Av. Othon Gama Deça, 579. Centro – Florianópolis', 'org_biocell', NOW()),
('unit_46', 'UABC VLAB', 'Palhoça', 'SC', 'Cão, gato', '(48) 99955-1451', 'Avenida Pedra Branca, 339. Pedra Branca – Palhoça', 'org_biocell', NOW()),
('unit_47', 'UA ESCOLA UNESP', 'Jaboticabal', 'SP', 'Cão, gato, equino', '(44) 99900-6272', 'Via de acesso Prof. Paulo Donato Castellane, s/n – Jaboticabal', 'org_biocell', NOW()),
('unit_48', 'UABC ANIMANIAC''S WEVETS', 'São Paulo', 'SP', 'Cão, gato', '(11) 3053-1667', 'Av. Pasteur, 50. Vila Matilde – São Paulo', 'org_biocell', NOW()),
('unit_49', 'UABC CLIPET', 'Ilhabela', 'SP', 'Cão, gato', '(12) 99604-9597', 'Avenida Almirante Tamandaré, 253. Itaquanduba – Ilhabela', 'org_biocell', NOW()),
('unit_50', 'UABC COOV', 'São Paulo', 'SP', 'Cão, gato', '(11) 99660-7027', 'Rua Dr. Jesuino Maciel, 1735. Campo Belo – São Paulo', 'org_biocell', NOW()),
('unit_51', 'UABC EMBRYOPLUS', 'Monte Mor', 'SP', 'Cão, gato, equino', '(19) 99163-5883', 'Rodovia Mor, 020, Sítio Santa Cruz – Monte Mor', 'org_biocell', NOW()),
('unit_52', 'UABC EQUALLI', 'São Paulo', 'SP', 'Cão, equino', '(11) 3031-6648', 'Rua Pero Leão, 95. Pinheiros – São Paulo', 'org_biocell', NOW()),
('unit_53', 'UABC ESPAÇO PET SP', 'São Paulo', 'SP', 'Cão, gato', '(11) 99894-1280', 'Rua Jupuruchita, 86. Mooca – São Paulo', 'org_biocell', NOW()),
('unit_54', 'UABC FRANPET PP', 'Presidente Prudente', 'SP', 'Cão, gato, equino', '(18) 99771-2021', 'Av. Manoel Goulart, 1499. Vila Santa Helena – Presidente Prudente', 'org_biocell', NOW()),
('unit_55', 'UABC FRANPET SJRP', 'São José do Rio Preto', 'SP', 'Cão, gato, equino', '(17) 99746-9292', 'Rua Vilibaldo Urias Gomes, 562 – São José do Rio Preto', 'org_biocell', NOW()),
('unit_56', 'UABC HAMA', 'São Paulo', 'SP', 'Cão, gato', '(11) 3885-0951', 'Avenida Brigadeiro Luís Antônio, 3758. Jardim Paulista – São Paulo', 'org_biocell', NOW()),
('unit_57', 'UABC HYPOLITTUS VET', 'São Caetano do Sul', 'SP', 'Cão, gato', '(11) 97090-2518', 'Avenida Vital Brasil Filho, 623. Osvaldo Cruz – São Caetano do Sul', 'org_biocell', NOW()),
('unit_58', 'UABC LAB VET INDAIATUBA', 'Indaiatuba', 'SP', 'Cão, equino', '(19) 97406-9541', 'Rodovia Eng. Ermenio de Oliveira Penteado, S/N – Indaiatuba', 'org_biocell', NOW()),
('unit_59', 'UABC LOVETS', 'Ribeirão Preto', 'SP', 'Cão, gato', '(16) 3512-7227', 'Avenida Itaiaia, 1150. Jardim Sumaré – Ribeirão Preto', 'org_biocell', NOW()),
('unit_60', 'UABC MIAU', 'Mogi das Cruzes', 'SP', 'Cão, gato', '(11) 3914-3900', 'Av. Laurinda Cardoso Melo Freire, 34. Vila Oliveira – Mogi das Cruzes', 'org_biocell', NOW()),
('unit_61', 'UABC MUNDO ANIMAL', 'Andradina', 'SP', 'Cão, gato', '(18) 99750-5957', 'Rua São Paulo, 1331. Centro – Andradina', 'org_biocell', NOW()),
('unit_62', 'UABC NOVUS CAMPUS', 'Araçatuba', 'SP', 'Cão, gato, equino', '(18) 99666-4067', 'Rua Duque de Caxias, 783. Jardim Bandeirante – Araçatuba', 'org_biocell', NOW()),
('unit_63', 'UABC PELLEGRINI', 'Santos', 'SP', 'Cão, gato', '(13) 3232-6201', 'R. Alexandre Herculano, 235 – Gonzaga, Santos', 'org_biocell', NOW()),
('unit_64', 'UABC QUALIVET', 'Ribeirão Preto', 'SP', 'Cão, gato', '(16) 99609-0874', 'R. Itacolomi, 480. Alto da Boa Vista – Ribeirão Preto', 'org_biocell', NOW()),
('unit_65', 'UABC TONIN NOVACELL', 'Indaiatuba', 'SP', 'Cão, gato', '(19) 99545-1883', 'Rua Pedro de Toledo, 64. Centro – Indaiatuba', 'org_biocell', NOW()),
('unit_66', 'UABC UNIVERSO FELINO', 'São Paulo', 'SP', 'Cão, gato', '(11) 97666-5681', 'R. Cel. Botelho, 51 – Bela Aliança, São Paulo', 'org_biocell', NOW()),
('unit_67', 'UABC VET APOIO', 'Campinas', 'SP', 'Cão, gato', '(19) 3217-9400', 'Rua Ourinhos, 3, casa C. Chácara da Barra – Campinas', 'org_biocell', NOW()),
('unit_68', 'UABC VET LIFE', 'Caraguatatuba', 'SP', 'Cão, gato', '(12) 3883-4882', 'Avenida Espírito Santo, 428. Jardim Primavera – Caraguatatuba', 'org_biocell', NOW()),
('unit_69', 'UABC VETKOUEN', 'Taubaté', 'SP', 'Cão, gato', '(12) 99227-6444', 'Praça Marta de Miranda Del Rei, 35. Taubaté', 'org_biocell', NOW()),
('unit_70', 'UABC VETVALE', 'São José dos Campos', 'SP', 'Cão, gato', '(12) 3207-1253', 'Rua Coronel João Cursino, 197. Vila Adyana – São José dos Campos', 'org_biocell', NOW()),
('unit_71', 'UABC VITA CARE VET', 'São Bernardo do Campo', 'SP', 'Cão, gato', '(11) 4361-5149', 'Avenida Helvétia, 204. Suíço – São Bernardo do Campo', 'org_biocell', NOW()),
('unit_72', 'UABC SYNVET', 'Palmas', 'TO', 'Cão, gato, equino', '(63) 99218-2780', 'Arso 43 Avenida Lo 9, lote 14. Plano Diretor Sul – Palmas', 'org_biocell', NOW()),
('unit_73', 'UABC COSTA RICA', 'Costa Rica', 'EXT', 'Cão, gato, equino', '', '', 'org_biocell', NOW());

-- Usuários (senha: biocell123)
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "organizationId", "createdAt") VALUES
('user_admin', 'Administrador Matriz', 'admin@biocell.com', '$2b$10$P17FxKYAYXESb6g7uoUCaeJfAwruW8BoQB95iUkZdhMKPODxLAW3K', 'ADMIN', 'org_biocell', NOW()),
('user_joao', 'Dr. João Silva', 'joao@clinilab.com', '$2b$10$P17FxKYAYXESb6g7uoUCaeJfAwruW8BoQB95iUkZdhMKPODxLAW3K', 'PROFESSIONAL', 'org_biocell', NOW()),
('user_maria', 'Maria Santos', 'maria@clinilab.com', '$2b$10$P17FxKYAYXESb6g7uoUCaeJfAwruW8BoQB95iUkZdhMKPODxLAW3K', 'UNIT_MANAGER', 'org_biocell', NOW());

-- Vínculos usuário-unidade
INSERT INTO "UserUnit" ("id", "userId", "unitId") VALUES
('uu_1', 'user_admin', 'unit_matriz'),
('uu_2', 'user_joao', 'unit_01'),
('uu_3', 'user_maria', 'unit_01');

-- Produtos celulares
INSERT INTO "CellProduct" ("id", "name", "code", "description", "species", "createdAt") VALUES
('prod_can', 'Células-tronco mesenquimais caninas', 'CTM-CAN', 'Células-tronco mesenquimais derivadas de tecido adiposo – canino', 'Cão', NOW()),
('prod_fel', 'Células-tronco mesenquimais felinas', 'CTM-FEL', 'Células-tronco mesenquimais derivadas de tecido adiposo – felino', 'Gato', NOW()),
('prod_equ', 'Células-tronco mesenquimais equinas', 'CTM-EQU', 'Células-tronco mesenquimais derivadas de tecido adiposo – equino', 'Equino', NOW());

-- Lotes
INSERT INTO "CellBatch" ("id", "batchNumber", "productId", "manufacturingDate", "expirationDate", "totalStraws", "storageConditions", "createdAt") VALUES
('lot_1', 'LOT-CAN-2025-001', 'prod_can', '2025-01-15', '2027-01-15', 200, 'Nitrogênio líquido -196°C', NOW()),
('lot_2', 'LOT-CAN-2025-002', 'prod_can', '2025-03-20', '2027-03-20', 150, 'Nitrogênio líquido -196°C', NOW()),
('lot_3', 'LOT-FEL-2025-001', 'prod_fel', '2025-02-10', '2027-02-10', 100, 'Nitrogênio líquido -196°C', NOW()),
('lot_4', 'LOT-EQU-2025-001', 'prod_equ', '2025-04-01', '2027-04-01', 80, 'Nitrogênio líquido -196°C', NOW());

-- Estoque CLINILAB
INSERT INTO "InventoryTransaction" ("id", "unitId", "batchId", "type", "quantity", "balance", "reason", "performedBy", "createdAt") VALUES
('inv_01', 'unit_01', 'lot_1', 'RECEIPT', 30, 30, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW()),
('inv_02', 'unit_01', 'lot_3', 'RECEIPT', 15, 15, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW()),
('inv_03', 'unit_01', 'lot_4', 'RECEIPT', 10, 10, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW());

-- Estoque outras unidades
INSERT INTO "InventoryTransaction" ("id", "unitId", "batchId", "type", "quantity", "balance", "reason", "performedBy", "createdAt") VALUES
('inv_04', 'unit_03', 'lot_1', 'RECEIPT', 20, 20, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW()),
('inv_05', 'unit_03', 'lot_3', 'RECEIPT', 10, 10, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW()),
('inv_06', 'unit_04', 'lot_1', 'RECEIPT', 25, 25, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW()),
('inv_07', 'unit_04', 'lot_3', 'RECEIPT', 12, 12, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW()),
('inv_08', 'unit_05', 'lot_1', 'RECEIPT', 18, 18, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW()),
('inv_09', 'unit_05', 'lot_3', 'RECEIPT', 9, 9, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW()),
('inv_10', 'unit_06', 'lot_1', 'RECEIPT', 22, 22, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW()),
('inv_11', 'unit_06', 'lot_3', 'RECEIPT', 11, 11, 'Recebimento inicial da matriz', 'Administrador Matriz', NOW());

-- Limites de estoque
INSERT INTO "StockThreshold" ("id", "unitId", "productName", "minimumStraws", "createdAt") VALUES
('st_1', 'unit_01', 'Células-tronco mesenquimais caninas', 10, NOW()),
('st_2', 'unit_01', 'Células-tronco mesenquimais felinas', 5, NOW());

-- Pacientes
INSERT INTO "Patient" ("id", "name", "species", "breed", "weight", "ownerName", "ownerPhone", "veterinarian", "clinic", "unitId", "createdAt", "updatedAt") VALUES
('pat_1', 'Rex', 'Cão', 'Labrador', 32.5, 'Carlos Oliveira', '(71) 99999-1111', 'Dr. João Silva', 'Clinilab', 'unit_01', NOW(), NOW()),
('pat_2', 'Mimi', 'Gato', 'Persa', 4.2, 'Ana Costa', '(71) 99999-2222', 'Dr. João Silva', 'Clinilab', 'unit_01', NOW(), NOW()),
('pat_3', 'Thor', 'Cão', 'Pastor Alemão', 38, 'Pedro Lima', '(71) 99999-3333', 'Dr. João Silva', 'Clinilab', 'unit_01', NOW(), NOW());

-- Prontuário completo
INSERT INTO "MedicalRecord" ("id", "serialNumber", "patientId", "unitId", "professionalId", "pathology", "cellQuantity", "applicationRoute", "donors", "serumCollected", "status", "completedAt", "createdAt", "updatedAt") VALUES
('mr_1', 'SN-2025-0001', 'pat_1', 'unit_01', 'user_joao', 'Displasia coxofemoral bilateral', '6 palhetas', 'Intra-articular', 'Doador #12', true, 'COMPLETED', '2025-08-20', NOW(), NOW());

-- Aplicações do prontuário
INSERT INTO "Application" ("id", "medicalRecordId", "number", "date", "cells", "serum", "medium") VALUES
('app_1', 'mr_1', 1, '2025-08-01', 'CTM-CAN 2M', 'Autólogo', 'PBS'),
('app_2', 'mr_1', 2, '2025-08-15', 'CTM-CAN 2M', 'Autólogo', 'PBS');

-- Descongelamentos
INSERT INTO "Thawing" ("id", "medicalRecordId", "number", "thawedStraws", "retrievalLocation") VALUES
('thaw_1', 'mr_1', 1, 3, 'Caneca 2 – posição 5'),
('thaw_2', 'mr_1', 2, 3, 'Caneca 2 – posição 6');

-- Baixa automática vinculada ao prontuário
INSERT INTO "InventoryTransaction" ("id", "unitId", "batchId", "type", "quantity", "balance", "medicalRecordId", "reason", "performedBy", "createdAt") VALUES
('inv_12', 'unit_01', 'lot_1', 'CONSUMPTION', -6, 24, 'mr_1', 'Consumo atendimento – Rex – Displasia coxofemoral', 'Dr. João Silva', NOW());
