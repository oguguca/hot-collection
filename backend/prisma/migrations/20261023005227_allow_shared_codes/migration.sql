-- DropIndex
DROP INDEX "HotWheel_code_key";

-- CreateIndex
CREATE INDEX "HotWheel_code_idx" ON "HotWheel"("code");

-- CreateIndex
CREATE INDEX "HotWheel_line_year_idx" ON "HotWheel"("line", "year");
