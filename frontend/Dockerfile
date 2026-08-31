# syntax=docker/dockerfile:1
#
# Frontend (Vite + React) — multi-stage: deps → build → test → runtime
# build context คือ frontend/ (ดู compose.yaml)

# ---------------------------------------------------------------------------
# deps — ติดตั้ง dependency ตาม lockfile ล้วน ๆ ยังไม่แตะ source
# ---------------------------------------------------------------------------
# pin tag node:24-alpine — alpine เล็กกว่า image เต็มมาก และงาน build ของ Vite
# เป็น JS ล้วน ไม่ต้องพึ่ง glibc · ห้ามใช้ `latest` เพราะ node major เปลี่ยนเองไม่ได้
FROM node:24-alpine AS deps

WORKDIR /app

# copy แค่ manifest ก่อน: layer npm ci จะถูก cache ไว้จนกว่า lockfile จะเปลี่ยนจริง
COPY package.json package-lock.json ./

# npm ci ≠ npm install — ci ติดตั้งตาม package-lock.json แบบตรงเป๊ะ ล้าง node_modules ก่อนเสมอ
# และ fail ทันทีถ้า lockfile ไม่ตรงกับ package.json · install แก้ lockfile ให้เองเงียบ ๆ ได้
# ซึ่งแปลว่า image ที่ build วันนี้กับพรุ่งนี้อาจได้ dependency คนละชุด
RUN npm ci

# ---------------------------------------------------------------------------
# build — คอมไพล์ static bundle ออกที่ dist/ · เป็น stage ที่ dev ใช้รัน vite dev ด้วย
# ---------------------------------------------------------------------------
FROM deps AS build

COPY . .

# ตัวแปร VITE_* เป็น build-time: ค่าถูกฝังลง bundle ตอน build ไม่ได้อ่านตอน runtime
# เปลี่ยนค่าแล้วต้อง build image ใหม่ การ restart container เฉย ๆ ไม่มีผล
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_GOOGLE_CLIENT_ID=481187031480-84p52vogdsiu9rtn6lrhucaut9bggp57.apps.googleusercontent.com
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------------------------------------------------------------------------
# test — stage ที่ compose.test.yaml ใช้รัน vitest
# ---------------------------------------------------------------------------
FROM build AS test

# --run อยู่ใน script `test` แล้ว (vitest run) จึงไม่ค้างรอโหมด watch ใน container
CMD ["npm", "test"]

# ---------------------------------------------------------------------------
# runtime — เสิร์ฟไฟล์ static ที่ build เสร็จแล้ว ไม่มี Node และไม่มี devDependency ติดไป
# ---------------------------------------------------------------------------
FROM nginx:1.29-alpine AS runtime

# เอาเฉพาะผลลัพธ์ของ build มา — source, node_modules (หลายร้อย MB) และ devDependency
# ไม่มีอะไรทำใน production image เลย
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# path ชั่วคราวที่ config ชี้ไว้ ต้องมีอยู่จริงและ user nginx ต้องเขียนได้
RUN mkdir -p /tmp/client_temp && chown -R nginx:nginx /tmp /usr/share/nginx/html

# non-root ด้วยเหตุผลเดียวกับฝั่ง backend — user `nginx` มีมากับ base image อยู่แล้ว
USER nginx

EXPOSE 8080

# wget มากับ busybox ของ alpine อยู่แล้ว จึงไม่ต้องลง curl เพิ่มเพื่อ healthcheck
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
