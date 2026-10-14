-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "serviceOrderEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "clinic" TEXT,
    "city" TEXT,
    "disease" TEXT,
    "diagnosisTime" TEXT,
    "checklist" TEXT NOT NULL DEFAULT '{}',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderApplication" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" TIMESTAMP(3),
    "veterinarian" TEXT,
    "financial" TEXT,
    "technicalNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "medicalRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrderApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderAttachment" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "checklistKey" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_serialNumber_key" ON "ServiceOrder"("serialNumber");

-- CreateIndex
CREATE INDEX "ServiceOrder_patientId_idx" ON "ServiceOrder"("patientId");

-- CreateIndex
CREATE INDEX "ServiceOrder_unitId_idx" ON "ServiceOrder"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrderApplication_medicalRecordId_key" ON "ServiceOrderApplication"("medicalRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrderApplication_serviceOrderId_number_key" ON "ServiceOrderApplication"("serviceOrderId", "number");

-- CreateIndex
CREATE INDEX "ServiceOrderAttachment_serviceOrderId_idx" ON "ServiceOrderAttachment"("serviceOrderId");

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderApplication" ADD CONSTRAINT "ServiceOrderApplication_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderApplication" ADD CONSTRAINT "ServiceOrderApplication_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderAttachment" ADD CONSTRAINT "ServiceOrderAttachment_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

