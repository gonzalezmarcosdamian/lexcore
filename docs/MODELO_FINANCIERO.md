# LexCore — Modelo Financiero

> **Supuestos base (abril 2026)**
> - Tipo de cambio USD MEP: $1.350 ARS (mil trescientos cincuenta pesos por dólar)
> - Infraestructura se paga en USD con tarjeta internacional
> - Todos los valores son mensuales, salvo indicación contraria
> - Precios redondeados para facilitar comunicación

---

## Resumen ejecutivo

| Indicador | Valor |
|-----------|-------|
| **Costo fijo mensual** | USD 26,50 (veintiséis dólares con cincuenta centavos) = ARS 35.775 (treinta y cinco mil setecientos setenta y cinco pesos) |
| **Break-even** | 1 (un) estudio en plan Pro ya cubre todos los costos |
| **Revenue promedio por estudio pagante** | USD 27,50 (veintisiete dólares con cincuenta centavos) con mix conservador |
| **Margen bruto desde el primer cliente** | 83% (ochenta y tres por ciento) en escenario pesimista |
| **Margen en escala** | 96% (noventa y seis por ciento) con 50 o más estudios pagos |

### Proyección de resultados netos por escenario

| Escenario | Estudios pagos | Neto mensual USD | Neto mensual ARS |
|-----------|----------------|-----------------|-----------------|
| **A — Pesimista** | 5 (cinco) | **USD 133** (ciento treinta y tres dólares) | **ARS 180.090** (ciento ochenta mil noventa pesos) |
| **B — Base** | 20 (veinte) | **USD 523** (quinientos veintitrés dólares) | **ARS 705.982** (setecientos cinco mil novecientos ochenta y dos pesos) |
| **C — Optimista** | 50 (cincuenta) | **USD 1.327** (mil trescientos veintisiete dólares) | **ARS 1.790.842** (un millón setecientos noventa mil ochocientos cuarenta y dos pesos) |
| **D — Escala** | 100 (cien) | **USD 2.645** (dos mil seiscientos cuarenta y cinco dólares) | **ARS 3.570.412** (tres millones quinientos setenta mil cuatrocientos doce pesos) |

> El producto es rentable **desde el primer cliente pagante**. Con 20 (veinte) estudios pagos se superan los USD 500 (quinientos dólares) netos mensuales. La estructura de costos es prácticamente fija hasta los 100 estudios.

---

## 1. Estructura de planes

| Plan | USD/mes | ARS/mes | Usuarios | Storage | IA | Target |
|------|---------|---------|----------|---------|-----|--------|
| **Trial** | Gratis | $0 | Ilimitado | 1 GB | ✗ | Evaluación 30 días |
| **Starter** | $15 | $20.250 | Hasta 3 | 5 GB | ✗ | Estudio chico (1-2 abogados) |
| **Pro** | $35 | $47.250 | Hasta 10 | 20 GB | ✓ 50 resúmenes/mes | Estudio mediano |
| **Estudio** | $80 | $108.000 | Ilimitado | 100 GB | ✓ 250 resúmenes/mes | Firma grande |

### Notas de diseño del pricing
- **Trial → conversión:** la fricción de ingresar tarjeta es el bloqueante principal. Ofrecer 20% de descuento el primer mes.
- **Starter sin IA:** deliberado. La IA es el gancho del salto a Pro.
- **Estudio precio fijo:** atractivo para firmas de 6 a 15 abogados que con Pro pagarían igual o más.
- **Diferenciador vs. competencia:** UX moderna + IA + precio en la mitad del mercado establecido.

---

## 2. Costos de infraestructura

### Costos fijos (independientes del número de estudios)

| Servicio | Plan | USD/mes | ARS/mes | Notas |
|----------|------|---------|---------|-------|
| Railway — backend | Hobby | $5,00 | $6.750 | 512 MB RAM; hasta ~50 estudios activos |
| Railway — PostgreSQL | Incluido | $0,00 | $0 | Incluido hasta 1 GB |
| Vercel — frontend | Pro | $20,00 | $27.000 | Custom domain + analytics |
| Dominio .com | — | $1,50 | $2.025 | ~$15 USD por año |
| Resend — email | Free | $0,00 | $0 | 3.000 (tres mil) emails/mes gratis |
| Sentry — errores | Free | $0,00 | $0 | 5.000 (cinco mil) eventos/mes gratis |
| **TOTAL FIJO** | | **$26,50** | **$35.775** | |

### Costos variables (escalan con uso)

| Servicio | Unidad de costo | Precio |
|----------|----------------|--------|
| Cloudflare R2 — storage | $0,015 por GB por mes | Primeros 10 GB gratis |
| OpenAI gpt-4o-mini — IA | ~$0,0002 por resumen | ~600 tokens promedio por llamada |
| Railway upgrade | +$10 a $20 por mes | Al superar 512 MB RAM |
| Resend sobre 3.000 emails | $0,001 por email | |

### Estimación de costos variables por escala

| Estudios activos | Storage | Llamadas IA/mes | Costo storage | Costo IA | **Total variable USD** | **Total variable ARS** |
|-----------------|---------|----------------|--------------|---------|----------------------|----------------------|
| 5 estudios | 5 GB | 500 | $0,00 | $0,10 | **$0,10** | **$135** |
| 20 estudios | 20 GB | 2.000 | $0,15 | $0,40 | **$0,55** | **$743** |
| 50 estudios | 60 GB | 6.000 | $0,75 | $1,20 | **$1,95** | **$2.633** |
| 100 estudios | 150 GB | 15.000 | $2,25 | $3,00 | **$5,25** | **$7.088** |

> **Conclusión:** los costos variables son negligibles hasta los 100 (cien) estudios. El costo fijo de USD 26,50 (veintiséis con cincuenta) domina completamente la estructura de costos.

---

## 3. Simulación de revenue

### Mix de planes estimado (conservador)
- 60% Starter → USD 15,00
- 30% Pro → USD 35,00
- 10% Estudio → USD 80,00

**Revenue promedio ponderado por estudio pagante:**
`(0,6 × $15) + (0,3 × $35) + (0,1 × $80) = $9 + $10,50 + $8 = $27,50 USD/mes`

---

### Escenario A — Pesimista
**Contexto:** 6 meses post-lanzamiento, 15 en trial, **5 (cinco) estudios pagos**

| Concepto | USD/mes | ARS/mes |
|----------|---------|---------|
| 3 × Starter ($15,00) | $45,00 | $60.750 |
| 1 × Pro ($35,00) | $35,00 | $47.250 |
| 1 × Estudio ($80,00) | $80,00 | $108.000 |
| **Revenue bruto** | **$160,00** | **$216.000** |
| Costos fijos | -$26,50 | -$35.775 |
| Costos variables | -$0,10 | -$135 |
| **RESULTADO NETO** | **$133,40** | **$180.090** |
| Margen | **83%** | |

---

### Escenario B — Base
**Contexto:** 12 meses, 40 en trial, **20 (veinte) estudios pagos**

| Concepto | USD/mes | ARS/mes |
|----------|---------|---------|
| 12 × Starter ($15,00) | $180,00 | $243.000 |
| 6 × Pro ($35,00) | $210,00 | $283.500 |
| 2 × Estudio ($80,00) | $160,00 | $216.000 |
| **Revenue bruto** | **$550,00** | **$742.500** |
| Costos fijos | -$26,50 | -$35.775 |
| Costos variables | -$0,55 | -$743 |
| **RESULTADO NETO** | **$522,95** | **$705.982** |
| Margen | **95%** | |

---

### Escenario C — Optimista
**Contexto:** 18 meses, 100 en trial, **50 (cincuenta) estudios pagos**

| Concepto | USD/mes | ARS/mes |
|----------|---------|---------|
| 30 × Starter ($15,00) | $450,00 | $607.500 |
| 15 × Pro ($35,00) | $525,00 | $708.750 |
| 5 × Estudio ($80,00) | $400,00 | $540.000 |
| **Revenue bruto** | **$1.375,00** | **$1.856.250** |
| Costos fijos (Railway upgrade incluido) | -$46,50 | -$62.775 |
| Costos variables | -$1,95 | -$2.633 |
| **RESULTADO NETO** | **$1.326,55** | **$1.790.842** |
| Margen | **96%** | |

---

### Escenario D — Escala
**Contexto:** 24+ meses, **100 (cien) estudios pagos estables**

| Concepto | USD/mes | ARS/mes |
|----------|---------|---------|
| 60 × Starter ($15,00) | $900,00 | $1.215.000 |
| 30 × Pro ($35,00) | $1.050,00 | $1.417.500 |
| 10 × Estudio ($80,00) | $800,00 | $1.080.000 |
| **Revenue bruto** | **$2.750,00** | **$3.712.500** |
| Infraestructura (Railway Pro) | -$100,00 | -$135.000 |
| Costos variables | -$5,25 | -$7.088 |
| **RESULTADO NETO** | **$2.644,75** | **$3.570.412** |
| Margen | **96%** | |

---

## 4. Break-even y puntos críticos

**Break-even mensual:** USD 26,50 (veintiséis dólares con cincuenta centavos) en costos fijos

| Plan | Estudios para cubrir costos | Estudios para USD 500 neto | Estudios para USD 2.000 neto |
|------|-----------------------------|-----------------------------|-------------------------------|
| Solo Starter ($15,00) | **2** (dos) | 37 (treinta y siete) | 137 (ciento treinta y siete) |
| Solo Pro ($35,00) | **1** (uno) | 16 (dieciséis) | 59 (cincuenta y nueve) |
| Solo Estudio ($80,00) | **1** (uno) | 8 (ocho) | 27 (veintisiete) |
| **Mix realista ($27,50)** | **1** (uno) | **20** (veinte) | **75** (setenta y cinco) |

> Con **1 (un) estudio en plan Pro** ya cubrís todos los costos. El producto es rentable desde el primer cliente.

---

## 5. Sensibilidad al tipo de cambio

Los costos de infra se pagan en USD. Si el dólar sube, el costo en ARS sube, pero el revenue también sube (si los precios están dolarizados). Recomendación: **publicar precio en USD y cobrar el equivalente en ARS al tipo del día**.

| USD/ARS | Starter ARS | Pro ARS | Estudio ARS | Costo fijo ARS | Neto (20 estudios pagos) |
|---------|------------|---------|-------------|---------------|--------------------------|
| $1.000 | $15.000 | $35.000 | $80.000 | $26.500 | ~$523.500 |
| $1.350 (hoy) | $20.250 | $47.250 | $108.000 | $35.775 | ~$706.000 |
| $1.800 | $27.000 | $63.000 | $144.000 | $47.700 | ~$941.300 |
| $2.500 | $37.500 | $87.500 | $200.000 | $66.250 | ~$1.307.500 |

> **La devaluación favorece el modelo si los precios están en USD.** El margen en USD no cambia; en ARS crece proporcionalmente.

---

## 6. Comparativa vs. competencia

| Producto | Precio aprox. USD/mes | Usuarios | IA | UX | Target |
|----------|-----------------------|----------|----|----|--------|
| **LexCore Starter** | **$15,00** | 3 | ✗ | ✓✓✓ | Estudio chico |
| **LexCore Pro** | **$35,00** | 10 | ✓ | ✓✓✓ | Estudio mediano |
| Iurisoft | $25 a $60 | variable | ✗ | ✓✓ | General |
| Lexis Nexis | $80 a $200 | variable | parcial | ✓ | Grandes firmas |
| Excel/Sheets | $0 | — | ✗ | — | Lo que reemplazamos |

**Posición competitiva:** LexCore compite de igual a igual con Iurisoft en precio, con UX significativamente mejor y IA como diferenciador exclusivo. El segmento "abogado individual o estudio de 2-3 personas" está subatendido en Argentina.

---

## 7. Hoja de ruta de monetización

| Hito | Acción | Timing |
|------|--------|--------|
| 0 clientes | Producto gratis — foco 100% en producto | Ahora |
| 3-5 en trial | Llamar a cada uno. Cerrar pago manual (transferencia o MP link) | Mes 1 al 2 |
| 10+ estudios | Integrar MercadoPago o Stripe para cobro recurrente automático | Mes 3 al 4 |
| 20+ estudios | Lanzar plan Estudio; outreach a firmas medianas | Mes 5 al 6 |
| 50+ estudios | Primer vendedor part-time o comisionado | Mes 8 al 10 |
| 100+ estudios | Plan Enterprise con SLA y soporte dedicado (cotización) | Año 2 |

### Canales de adquisición sin inversión publicitaria
1. **Referidos entre estudios:** los abogados se conocen. 1 (un) cliente satisfecho puede traer 3 (tres).
2. **WhatsApp intake** (Sprint 10): cada prospecto que interactúa con el bot es un lead calificado.
3. **SEO:** artículos sobre gestión de estudio, vencimientos procesales, organización de expedientes.
4. **Colegios de abogados:** patrocinar un evento o dar una charla = visibilidad directa al target.
5. **LinkedIn:** contenido sobre productividad legal → leads orgánicos del perfil profesional.

---

*Última actualización: 2026-04-16 — revisar mensualmente con datos reales de conversión y tipo de cambio.*
