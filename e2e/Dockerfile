# syntax=docker/dockerfile:1
#
# E2E runner — Playwright ต้องมีเบราว์เซอร์จริงกับ system library อีกหลายสิบตัว
# image ทางการของ Playwright มีทั้งหมดนั้นมาแล้ว การลงเองบน node:alpine ทำไม่ได้
# (Chromium ที่ Playwright ใช้ต้องการ glibc)
#
# build context คือ root ของ repo เพราะ playwright.config.ts และ package.json อยู่ระดับ root

# tag ต้องตรงกับเวอร์ชันของ @playwright/test ใน package.json เป๊ะ ๆ
# ถ้าไม่ตรง Playwright จะ error ว่าเบราว์เซอร์ที่ติดตั้งไว้คนละรุ่นกับ library
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS e2e

WORKDIR /work

# manifest ก่อน source ตามเดิม — layer npm ci จะ cache ไว้จนกว่า lockfile จะเปลี่ยน
COPY package.json package-lock.json ./
RUN npm ci

# เอาเฉพาะสิ่งที่ test ใช้จริง ไม่ต้องลากทั้ง repo เข้ามา
COPY playwright.config.ts ./
COPY e2e ./e2e

# CI=1 ทำให้ config เปิด forbidOnly (กัน .only ที่ลืมลบ) และ retry 1 ครั้ง
# ค่าเดียวกับที่ GitHub Actions ตั้งให้เอง — environment ของ test จึงเหมือนกันทั้งสองที่
ENV CI=1

CMD ["npx", "playwright", "test"]
