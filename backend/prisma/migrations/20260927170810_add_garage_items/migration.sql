-- CreateTable
CREATE TABLE "GarageItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hotWheelId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GarageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GarageItem_userId_hotWheelId_key" ON "GarageItem"("userId", "hotWheelId");

-- AddForeignKey
ALTER TABLE "GarageItem" ADD CONSTRAINT "GarageItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageItem" ADD CONSTRAINT "GarageItem_hotWheelId_fkey" FOREIGN KEY ("hotWheelId") REFERENCES "HotWheel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
