-- CreateTable
CREATE TABLE "EmployeeTracker" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tid" TEXT NOT NULL,
    "topic" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "acc" DOUBLE PRECISION,
    "tst" TIMESTAMP(3) NOT NULL,
    "event" TEXT,
    "conn" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeTracker_employeeId_key" ON "EmployeeTracker"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeTracker_tid_key" ON "EmployeeTracker"("tid");

-- CreateIndex
CREATE INDEX "EmployeeTracker_tid_idx" ON "EmployeeTracker"("tid");

-- CreateIndex
CREATE INDEX "LocationPing_employeeId_tst_idx" ON "LocationPing"("employeeId", "tst");

-- CreateIndex
CREATE INDEX "LocationPing_tid_tst_idx" ON "LocationPing"("tid", "tst");

-- AddForeignKey
ALTER TABLE "EmployeeTracker" ADD CONSTRAINT "EmployeeTracker_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationPing" ADD CONSTRAINT "LocationPing_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

