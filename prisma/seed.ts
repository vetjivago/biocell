import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const UNITS = [
  { name: "UABC CLINILAB", city: "Salvador", state: "BA", species: "Cão, gato, equino", phone: "(71) 99185-0075", address: "Rua Alto do Girassol, nº 530. Cassange – Salvador" },
  { name: "UABC REGENERAVET", city: "Ilhéus", state: "BA", species: "Cão, gato", phone: "(73) 98200-0698", address: "Avenida Lomanto Júnior, 950. Pontal – Ilhéus" },
  { name: "UABC ÁGUAS CLARAS", city: "Brasília", state: "DF", species: "Cão, gato", phone: "(61) 99921-6776", address: "Rua 25 Sul, lote 30, bloco A, loja 105 – Águas Claras" },
  { name: "UABC AMPARO", city: "Brasília", state: "DF", species: "Cão, gato", phone: "(61) 3257-8900", address: "CLS 111 Bloco C Lj 36 – Asa Sul" },
  { name: "UABC BIO REPRODUÇÃO ANIMAL", city: "Brasília", state: "DF", species: "Equino", phone: "(61) 3382-7407", address: "SMPW Quadra 5, conj 5, Lote 1, casa C – Park Way" },
  { name: "UABC CVV", city: "Brasília", state: "DF", species: "Cão, gato", phone: "(61) 98209-5884", address: "Condomínio San Diego, etapa 1, rua 1, lote 385 – Jardim Botânico" },
  { name: "UABC GABRIELA GUENKA", city: "Brasília", state: "DF", species: "Equino", phone: "(61) 99963-6167", address: "Núcleo Rural Morro da Capelinha, chácara 06 – Planaltina" },
  { name: "UABC STAR VET", city: "Brasília", state: "DF", species: "Cão, gato", phone: "(61) 99693-3018", address: "Avenida Pau Brasil, Lote 11, Lojas 4, 5, 6 e 7 – Águas Claras" },
  { name: "UABC EQUUS CENTER", city: "Goiânia", state: "GO", species: "Equino", phone: "(62) 98560-8484", address: "Rodovia GO-010. Km 13, Zona Rural – Goiânia" },
  { name: "UABC MEDCÃO", city: "Goiânia", state: "GO", species: "Cão, gato", phone: "(62) 3091-4386", address: "Av. Mangalô, Qd 10, Lt 32. Setor Morada do Sol – Goiânia" },
  { name: "UABC CERNITAS", city: "São Luís", state: "MA", species: "Cão, gato", phone: "(98) 3244-3416", address: "Avenida Alcino Búlio, 17. Cohab Anil III – São Luís" },
  { name: "UABC CLINIVET", city: "Guarantã do Norte", state: "MT", species: "Cão, gato", phone: "(66) 9611-4330", address: "Av. Dante Martins de Oliveira, 1225. Cidade Nova – Guarantã do Norte" },
  { name: "UABC SPA ANIMAL", city: "Primavera do Leste", state: "MT", species: "Cão, gato", phone: "(66) 3498-9552", address: "Av. Campo Grande, 1090. Centro – Primavera do Leste" },
  { name: "UABC VET VIDA", city: "Cuiabá", state: "MT", species: "Cão, gato, equino", phone: "(65) 3621-4092", address: "Av. Miguel Sutil, 5717. Quilombo – Cuiabá" },
  { name: "UABC DOURADOS", city: "Dourados", state: "MS", species: "Cão, gato", phone: "(67) 99913-9454", address: "Rua Olinda Pires de Almeida, 500. Vila Aurora – Dourados" },
  { name: "UABC LABDOC", city: "Campo Grande", state: "MS", species: "Cão, gato, equino", phone: "(67) 99955-4241", address: "Avenida Tamandáré, 6000 (HOVET UCDB). Jardim Seminário – Campo Grande" },
  { name: "UABC PATAS E GARRAS", city: "Costa Rica", state: "MS", species: "Cão, gato", phone: "(67) 99908-7429", address: "Rua Antonio Bocalan, 90. Centro – Costa Rica" },
  { name: "UABC ZHEN VET", city: "Campo Grande", state: "MS", species: "Cão, gato", phone: "(67) 98402-3581", address: "Avenida Mato Grosso, 3745. Santa Fé – Campo Grande" },
  { name: "UA ESCOLA UFU", city: "Uberlândia", state: "MG", species: "Equino", phone: "(19) 98176-5305", address: "R. Ceará, 1084. Bloco 2D UFU (Campus Umuarama) – Uberlândia" },
  { name: "UABC DOS VALES", city: "Teófilo Otoni", state: "MG", species: "Cão, gato, equino", phone: "(33) 98825-2582", address: "Rua Padre Virgulino, 1036. Centro – Teófilo Otoni" },
  { name: "UABC ESPAÇO PET BH", city: "Belo Horizonte", state: "MG", species: "Cão, gato, equino", phone: "(31) 98550-1400", address: "Av. José Candido da Silveira, 631. Cidade Nova – Belo Horizonte" },
  { name: "UABC SÃO FRANCISCO", city: "Conselheiro Lafaiete", state: "MG", species: "Cão, gato", phone: "(31) 3721-1530", address: "Rua Duque de Caxias, 352. Chapada – Conselheiro Lafaiete" },
  { name: "UABC VETMASTER", city: "Belo Horizonte", state: "MG", species: "Cão, gato", phone: "(31) 99193-1146", address: "Rua Póvoa de Varzim, 480. Paquetá – Belo Horizonte" },
  { name: "UABC AMOR & VET", city: "Londrina", state: "PR", species: "Cão, gato, equino", phone: "(43) 98811-7033", address: "Avenida Aminthas de Barros, 475. Ipanema – Londrina" },
  { name: "UABC AUQMIA", city: "Bandeirantes", state: "PR", species: "Cão, gato", phone: "(43) 99128-5309", address: "Av. Bandeirantes, 189. Centro – Bandeirantes" },
  { name: "UABC CLINIVET PR", city: "Curitiba", state: "PR", species: "Cão, gato", phone: "(41) 3257-4326", address: "Rua Holanda, 894. Boa Vista – Curitiba" },
  { name: "UABC OFTALMOVET", city: "Cascavel", state: "PR", species: "Cão, gato", phone: "(45) 3222-4855", address: "Rua Osvaldo Cruz, 2158. Centro – Cascavel" },
  { name: "UABC PRONTO DOG", city: "Maringá", state: "PR", species: "Cão, gato", phone: "(44) 3226-3739", address: "Av. São Paulo, 1654. Zona 02 – Maringá" },
  { name: "UABC VETS COM AMOR", city: "Pato Branco", state: "PR", species: "Cão, gato", phone: "(46) 3223-1542", address: "Rua Paraná, 588. Centro – Pato Branco" },
  { name: "UABC CEVEPE", city: "Petrolina", state: "PE", species: "Cão, gato, equino", phone: "(87) 3862-3989", address: "Rua Engenheiro Carlos Pinheiro, 382. Centro – Petrolina" },
  { name: "UABC HARMONIA", city: "Recife", state: "PE", species: "Cão, gato", phone: "(81) 3126-7555", address: "Estrada do Encanamento, 585. Casa Forte – Recife" },
  { name: "UABC UDVET", city: "Teresina", state: "PI", species: "Cão, gato, equino", phone: "(86) 3305-6825", address: "Rua Professor Pires Gayoso, 335. São João – Teresina" },
  { name: "UABC ESPECILAB", city: "Rio de Janeiro", state: "RJ", species: "Cão, gato, equino", phone: "(21) 99318-4564", address: "Rua Ipiranga, 107. Laranjeiras – Rio de Janeiro" },
  { name: "UABC MUNDO À PARTE NITERÓI", city: "Niterói", state: "RJ", species: "Cão, gato", phone: "(21) 3741-2690", address: "Av. Rui Barbosa, 274, Loja 102. São Francisco – Niterói" },
  { name: "UABC DR. ÁLVARO ABREU", city: "Canela", state: "RS", species: "Cão, gato, equino", phone: "(54) 3282-8856", address: "Av. Dom Luiz Guanella, 1093. São José – Canela" },
  { name: "UABC HOSPITAL VET URUGUAIANA", city: "Uruguaiana", state: "RS", species: "Cão, gato", phone: "(55) 99960-6070", address: "Rua Domingos de Almeida, 2467. Centro – Uruguaiana" },
  { name: "UABC LA VIE LABORATÓRIO", city: "Osório", state: "RS", species: "Cão, gato, equino", phone: "(51) 99986-5258", address: "Rua Costa Gama, 855, sala 3. Sulbrasileiro – Osório" },
  { name: "UABC NEFROCELL", city: "Porto Alegre", state: "RS", species: "Cão, gato", phone: "(51) 9567-5645", address: "Av. Sertório, 4903. Jardim São Pedro – Porto Alegre" },
  { name: "UABC ORO", city: "Erechim", state: "RS", species: "Cão, gato", phone: "(54) 99625-2661", address: "Rua Marechal Floriano, 309. Centro – Erechim" },
  { name: "UABC SOLUTIONS VET", city: "Porto Alegre", state: "RS", species: "Cão, gato", phone: "(51) 99745-6188", address: "Rua Quintino Bocaiuva, 715. Moinhos de Vento – Porto Alegre" },
  { name: "UABC SANTA MARIA", city: "Ariquemes", state: "RO", species: "Cão, gato", phone: "(69) 99322-4202", address: "Avenida Juscelino Kubitschek, 2302. Setor 04 – Ariquemes" },
  { name: "UABC ADHARAS", city: "Itajaí", state: "SC", species: "Cão, gato", phone: "(47) 98411-9731", address: "Av. Sete de Setembro, 1084 – Fazenda, Itajaí/SC" },
  { name: "UABC BICHOS", city: "Itajaí", state: "SC", species: "Cão, gato", phone: "(47) 99918-9042", address: "Rua Manoel Aníbal Pereira, 469. Dom Bosco – Itajaí" },
  { name: "UABC MAP PETBLU", city: "Blumenau", state: "SC", species: "Cão, gato", phone: "", address: "" },
  { name: "UABC SAINT GERMAIN", city: "Florianópolis", state: "SC", species: "Cão, gato", phone: "(48) 99981-4193", address: "Av. Othon Gama Deça, 579. Centro – Florianópolis" },
  { name: "UABC VLAB", city: "Palhoça", state: "SC", species: "Cão, gato", phone: "(48) 99955-1451", address: "Avenida Pedra Branca, 339. Pedra Branca – Palhoça" },
  { name: "UA ESCOLA UNESP", city: "Jaboticabal", state: "SP", species: "Cão, gato, equino", phone: "(44) 99900-6272", address: "Via de acesso Prof. Paulo Donato Castellane, s/n – Jaboticabal" },
  { name: "UABC ANIMANIAC'S WEVETS", city: "São Paulo", state: "SP", species: "Cão, gato", phone: "(11) 3053-1667", address: "Av. Pasteur, 50. Vila Matilde – São Paulo" },
  { name: "UABC CLIPET", city: "Ilhabela", state: "SP", species: "Cão, gato", phone: "(12) 99604-9597", address: "Avenida Almirante Tamandaré, 253. Itaquanduba – Ilhabela" },
  { name: "UABC COOV", city: "São Paulo", state: "SP", species: "Cão, gato", phone: "(11) 99660-7027", address: "Rua Dr. Jesuino Maciel, 1735. Campo Belo – São Paulo" },
  { name: "UABC EMBRYOPLUS", city: "Monte Mor", state: "SP", species: "Cão, gato, equino", phone: "(19) 99163-5883", address: "Rodovia Mor, 020, Sítio Santa Cruz – Monte Mor" },
  { name: "UABC EQUALLI", city: "São Paulo", state: "SP", species: "Cão, equino", phone: "(11) 3031-6648", address: "Rua Pero Leão, 95. Pinheiros – São Paulo" },
  { name: "UABC ESPAÇO PET SP", city: "São Paulo", state: "SP", species: "Cão, gato", phone: "(11) 99894-1280", address: "Rua Jupuruchita, 86. Mooca – São Paulo" },
  { name: "UABC FRANPET PP", city: "Presidente Prudente", state: "SP", species: "Cão, gato, equino", phone: "(18) 99771-2021", address: "Av. Manoel Goulart, 1499. Vila Santa Helena – Presidente Prudente" },
  { name: "UABC FRANPET SJRP", city: "São José do Rio Preto", state: "SP", species: "Cão, gato, equino", phone: "(17) 99746-9292", address: "Rua Vilibaldo Urias Gomes, 562 – São José do Rio Preto" },
  { name: "UABC HAMA", city: "São Paulo", state: "SP", species: "Cão, gato", phone: "(11) 3885-0951", address: "Avenida Brigadeiro Luís Antônio, 3758. Jardim Paulista – São Paulo" },
  { name: "UABC HYPOLITTUS VET", city: "São Caetano do Sul", state: "SP", species: "Cão, gato", phone: "(11) 97090-2518", address: "Avenida Vital Brasil Filho, 623. Osvaldo Cruz – São Caetano do Sul" },
  { name: "UABC LAB VET INDAIATUBA", city: "Indaiatuba", state: "SP", species: "Cão, equino", phone: "(19) 97406-9541", address: "Rodovia Eng. Ermenio de Oliveira Penteado, S/N – Indaiatuba" },
  { name: "UABC LOVETS", city: "Ribeirão Preto", state: "SP", species: "Cão, gato", phone: "(16) 3512-7227", address: "Avenida Itaiaia, 1150. Jardim Sumaré – Ribeirão Preto" },
  { name: "UABC MIAU", city: "Mogi das Cruzes", state: "SP", species: "Cão, gato", phone: "(11) 3914-3900", address: "Av. Laurinda Cardoso Melo Freire, 34. Vila Oliveira – Mogi das Cruzes" },
  { name: "UABC MUNDO ANIMAL", city: "Andradina", state: "SP", species: "Cão, gato", phone: "(18) 99750-5957", address: "Rua São Paulo, 1331. Centro – Andradina" },
  { name: "UABC NOVUS CAMPUS", city: "Araçatuba", state: "SP", species: "Cão, gato, equino", phone: "(18) 99666-4067", address: "Rua Duque de Caxias, 783. Jardim Bandeirante – Araçatuba" },
  { name: "UABC PELLEGRINI", city: "Santos", state: "SP", species: "Cão, gato", phone: "(13) 3232-6201", address: "R. Alexandre Herculano, 235 – Gonzaga, Santos" },
  { name: "UABC QUALIVET", city: "Ribeirão Preto", state: "SP", species: "Cão, gato", phone: "(16) 99609-0874", address: "R. Itacolomi, 480. Alto da Boa Vista – Ribeirão Preto" },
  { name: "UABC TONIN NOVACELL", city: "Indaiatuba", state: "SP", species: "Cão, gato", phone: "(19) 99545-1883", address: "Rua Pedro de Toledo, 64. Centro – Indaiatuba" },
  { name: "UABC UNIVERSO FELINO", city: "São Paulo", state: "SP", species: "Cão, gato", phone: "(11) 97666-5681", address: "R. Cel. Botelho, 51 – Bela Aliança, São Paulo" },
  { name: "UABC VET APOIO", city: "Campinas", state: "SP", species: "Cão, gato", phone: "(19) 3217-9400", address: "Rua Ourinhos, 3, casa C. Chácara da Barra – Campinas" },
  { name: "UABC VET LIFE", city: "Caraguatatuba", state: "SP", species: "Cão, gato", phone: "(12) 3883-4882", address: "Avenida Espírito Santo, 428. Jardim Primavera – Caraguatatuba" },
  { name: "UABC VETKOUEN", city: "Taubaté", state: "SP", species: "Cão, gato", phone: "(12) 99227-6444", address: "Praça Marta de Miranda Del Rei, 35. Taubaté" },
  { name: "UABC VETVALE", city: "São José dos Campos", state: "SP", species: "Cão, gato", phone: "(12) 3207-1253", address: "Rua Coronel João Cursino, 197. Vila Adyana – São José dos Campos" },
  { name: "UABC VITA CARE VET", city: "São Bernardo do Campo", state: "SP", species: "Cão, gato", phone: "(11) 4361-5149", address: "Avenida Helvétia, 204. Suíço – São Bernardo do Campo" },
  { name: "UABC SYNVET", city: "Palmas", state: "TO", species: "Cão, gato, equino", phone: "(63) 99218-2780", address: "Arso 43 Avenida Lo 9, lote 14. Plano Diretor Sul – Palmas" },
  { name: "UABC COSTA RICA", city: "Costa Rica", state: "EXT", species: "Cão, gato, equino", phone: "", address: "" },
];

async function main() {
  // Organização
  const org = await prisma.organization.create({
    data: { name: "Bio Cell by Vetnil" },
  });

  // Matriz
  const matriz = await prisma.unit.create({
    data: {
      name: "MATRIZ BIO CELL",
      city: "São Paulo",
      state: "SP",
      species: "Cão, gato, equino",
      address: "Matriz Bio Cell – Vetnil",
      organizationId: org.id,
    },
  });

  // Unidades
  const unitIds: string[] = [matriz.id];
  for (const u of UNITS) {
    const unit = await prisma.unit.create({
      data: { ...u, organizationId: org.id },
    });
    unitIds.push(unit.id);
  }

  const hash = await bcrypt.hash("biocell123", 10);

  // Usuário Admin (Matriz)
  const admin = await prisma.user.create({
    data: {
      name: "Administrador Matriz",
      email: "admin@biocell.com",
      passwordHash: hash,
      role: "ADMIN",
      organizationId: org.id,
    },
  });
  await prisma.userUnit.create({ data: { userId: admin.id, unitId: matriz.id } });

  // Usuário demo para a primeira unidade (CLINILAB)
  const profissional = await prisma.user.create({
    data: {
      name: "Dr. João Silva",
      email: "joao@clinilab.com",
      passwordHash: hash,
      role: "PROFESSIONAL",
      organizationId: org.id,
    },
  });
  await prisma.userUnit.create({ data: { userId: profissional.id, unitId: unitIds[1] } });

  // Gestor da unidade CLINILAB
  const gestor = await prisma.user.create({
    data: {
      name: "Maria Santos",
      email: "maria@clinilab.com",
      passwordHash: hash,
      role: "UNIT_MANAGER",
      organizationId: org.id,
    },
  });
  await prisma.userUnit.create({ data: { userId: gestor.id, unitId: unitIds[1] } });

  // Produtos celulares
  const prodCanino = await prisma.cellProduct.create({
    data: {
      name: "Células-tronco mesenquimais caninas",
      code: "CTM-CAN",
      description: "Células-tronco mesenquimais derivadas de tecido adiposo – canino",
      species: "Cão",
    },
  });
  const prodFelino = await prisma.cellProduct.create({
    data: {
      name: "Células-tronco mesenquimais felinas",
      code: "CTM-FEL",
      description: "Células-tronco mesenquimais derivadas de tecido adiposo – felino",
      species: "Gato",
    },
  });
  const prodEquino = await prisma.cellProduct.create({
    data: {
      name: "Células-tronco mesenquimais equinas",
      code: "CTM-EQU",
      description: "Células-tronco mesenquimais derivadas de tecido adiposo – equino",
      species: "Equino",
    },
  });

  // Lotes de exemplo
  const lote1 = await prisma.cellBatch.create({
    data: {
      batchNumber: "LOT-CAN-2025-001",
      productId: prodCanino.id,
      manufacturingDate: new Date("2025-01-15"),
      expirationDate: new Date("2027-01-15"),
      totalStraws: 200,
      storageConditions: "Nitrogênio líquido -196°C",
    },
  });
  const lote2 = await prisma.cellBatch.create({
    data: {
      batchNumber: "LOT-CAN-2025-002",
      productId: prodCanino.id,
      manufacturingDate: new Date("2025-03-20"),
      expirationDate: new Date("2027-03-20"),
      totalStraws: 150,
      storageConditions: "Nitrogênio líquido -196°C",
    },
  });
  const lote3 = await prisma.cellBatch.create({
    data: {
      batchNumber: "LOT-FEL-2025-001",
      productId: prodFelino.id,
      manufacturingDate: new Date("2025-02-10"),
      expirationDate: new Date("2027-02-10"),
      totalStraws: 100,
      storageConditions: "Nitrogênio líquido -196°C",
    },
  });
  const lote4 = await prisma.cellBatch.create({
    data: {
      batchNumber: "LOT-EQU-2025-001",
      productId: prodEquino.id,
      manufacturingDate: new Date("2025-04-01"),
      expirationDate: new Date("2027-04-01"),
      totalStraws: 80,
      storageConditions: "Nitrogênio líquido -196°C",
    },
  });

  // Estoque inicial para CLINILAB (unitIds[1])
  const clinilab = unitIds[1];
  await prisma.inventoryTransaction.create({
    data: { unitId: clinilab, batchId: lote1.id, type: "RECEIPT", quantity: 30, balance: 30, reason: "Recebimento inicial da matriz", performedBy: admin.name },
  });
  await prisma.inventoryTransaction.create({
    data: { unitId: clinilab, batchId: lote3.id, type: "RECEIPT", quantity: 15, balance: 15, reason: "Recebimento inicial da matriz", performedBy: admin.name },
  });
  await prisma.inventoryTransaction.create({
    data: { unitId: clinilab, batchId: lote4.id, type: "RECEIPT", quantity: 10, balance: 10, reason: "Recebimento inicial da matriz", performedBy: admin.name },
  });

  // Estoque para mais 4 unidades de exemplo
  for (let i = 2; i <= 5; i++) {
    const uid = unitIds[i];
    const qty = 10 + Math.floor(Math.random() * 20);
    await prisma.inventoryTransaction.create({
      data: { unitId: uid, batchId: lote1.id, type: "RECEIPT", quantity: qty, balance: qty, reason: "Recebimento inicial da matriz", performedBy: admin.name },
    });
    await prisma.inventoryTransaction.create({
      data: { unitId: uid, batchId: lote3.id, type: "RECEIPT", quantity: Math.floor(qty / 2), balance: Math.floor(qty / 2), reason: "Recebimento inicial da matriz", performedBy: admin.name },
    });
  }

  // Limites de estoque
  await prisma.stockThreshold.create({ data: { unitId: clinilab, productName: "Células-tronco mesenquimais caninas", minimumStraws: 10 } });
  await prisma.stockThreshold.create({ data: { unitId: clinilab, productName: "Células-tronco mesenquimais felinas", minimumStraws: 5 } });

  // Pacientes de exemplo
  const p1 = await prisma.patient.create({
    data: { name: "Rex", species: "Cão", breed: "Labrador", weight: 32.5, ownerName: "Carlos Oliveira", ownerPhone: "(71) 99999-1111", veterinarian: "Dr. João Silva", clinic: "Clinilab", unitId: clinilab },
  });
  const p2 = await prisma.patient.create({
    data: { name: "Mimi", species: "Gato", breed: "Persa", weight: 4.2, ownerName: "Ana Costa", ownerPhone: "(71) 99999-2222", veterinarian: "Dr. João Silva", clinic: "Clinilab", unitId: clinilab },
  });
  const p3 = await prisma.patient.create({
    data: { name: "Thor", species: "Cão", breed: "Pastor Alemão", weight: 38, ownerName: "Pedro Lima", ownerPhone: "(71) 99999-3333", veterinarian: "Dr. João Silva", clinic: "Clinilab", unitId: clinilab },
  });

  // Prontuário de exemplo (completo)
  const mr = await prisma.medicalRecord.create({
    data: {
      patientId: p1.id,
      unitId: clinilab,
      professionalId: profissional.id,
      pathology: "Displasia coxofemoral bilateral",
      cellQuantity: "6 palhetas",
      applicationRoute: "Intra-articular",
      donors: "Doador #12",
      serumCollected: true,
      status: "COMPLETED",
      completedAt: new Date("2025-08-20"),
    },
  });

  await prisma.application.createMany({
    data: [
      { medicalRecordId: mr.id, number: 1, date: new Date("2025-08-01"), cells: "CTM-CAN 2M", serum: "Autólogo", medium: "PBS" },
      { medicalRecordId: mr.id, number: 2, date: new Date("2025-08-15"), cells: "CTM-CAN 2M", serum: "Autólogo", medium: "PBS" },
    ],
  });

  await prisma.thawing.createMany({
    data: [
      { medicalRecordId: mr.id, number: 1, thawedStraws: 3, retrievalLocation: "Caneca 2 – posição 5" },
      { medicalRecordId: mr.id, number: 2, thawedStraws: 3, retrievalLocation: "Caneca 2 – posição 6" },
    ],
  });

  // Baixa automática de estoque vinculada ao prontuário
  await prisma.inventoryTransaction.create({
    data: { unitId: clinilab, batchId: lote1.id, type: "CONSUMPTION", quantity: -6, balance: 24, medicalRecordId: mr.id, reason: "Consumo atendimento – Rex – Displasia coxofemoral", performedBy: profissional.name },
  });

  console.log("Seed concluído!");
  console.log(`  Organização: ${org.name}`);
  console.log(`  Unidades: ${UNITS.length + 1} (matriz + ${UNITS.length} UABCs)`);
  console.log(`  Produtos: 3`);
  console.log(`  Lotes: 4`);
  console.log(`  Pacientes: 3`);
  console.log(`  Prontuários: 1`);
  console.log(`  Usuários demo:`);
  console.log(`    admin@biocell.com / biocell123 (Matriz)`);
  console.log(`    joao@clinilab.com / biocell123 (Profissional)`);
  console.log(`    maria@clinilab.com / biocell123 (Gestor Unidade)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
