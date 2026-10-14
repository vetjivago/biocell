-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "coat" TEXT,
ADD COLUMN     "microchip" TEXT,
ADD COLUMN     "neutered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerAddress" TEXT,
ADD COLUMN     "sex" TEXT;

-- AlterTable
ALTER TABLE "ClinicalEntry" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "returnDate" TIMESTAMP(3),
ADD COLUMN     "subtype" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "PatientPhoto" (
    "patientId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPhoto_pkey" PRIMARY KEY ("patientId")
);

-- AddForeignKey
ALTER TABLE "PatientPhoto" ADD CONSTRAINT "PatientPhoto_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

