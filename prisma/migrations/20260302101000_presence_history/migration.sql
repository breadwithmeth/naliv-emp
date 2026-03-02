-- CreateTable
CREATE TABLE "PresenceHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "PresenceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresenceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresenceHistory_employeeId_idx" ON "PresenceHistory"("employeeId");

-- AddForeignKey
ALTER TABLE "PresenceHistory" ADD CONSTRAINT "PresenceHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

