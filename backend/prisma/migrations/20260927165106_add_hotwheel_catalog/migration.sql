-- CreateTable
CREATE TABLE "HotWheel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "toyNumber" TEXT,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "manufacturer" TEXT NOT NULL DEFAULT 'Mattel',
    "year" INTEGER,
    "series" TEXT,
    "collection" TEXT,
    "collectionNumber" TEXT,
    "seriesNumber" TEXT,
    "imageUrl" TEXT,
    "packagingImageUrl" TEXT,
    "description" TEXT,
    "variation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotWheel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HotWheel_code_key" ON "HotWheel"("code");
