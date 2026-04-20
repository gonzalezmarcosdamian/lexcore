# LexCore — Ideas de Negocio

> Documento vivo. Captura ideas sin filtrar — algunas madurarán en features, otras en modelos separados.
> No es un backlog. Es un lugar para pensar en voz alta.

**Última actualización:** 2026-04-15

---

## El insight central (de abogado usuario real)

> "El sistema va a saber cosas que ningún actor individual sabe."

Cuando LexCore tiene datos de 50 estudios en Córdoba, empieza a saber:
- Cuánto tarda promedio un juicio laboral en el fuero de Córdoba Capital
- Qué juzgados son más rápidos en dictar sentencia
- Cuánto cobran los estudios por tipo de caso (sin exponer datos individuales)
- Qué cláusulas de honorarios son más comunes
- Cuál es la tasa de cobro real vs acordado

Esto **no lo tiene el Poder Judicial, no lo tiene ningún colegio de abogados, no lo tiene ninguna editorial jurídica**. Lo tiene LexCore porque procesa el día a día real de los estudios.

---

## Línea 1 — SaaS Core (el negocio actual)

**Modelo:** Trial 30 días → suscripción mensual por estudio
**Target inicial:** estudios medianos Córdoba (2-10 abogados)
**Precio estimado de mercado:** USD 30-80/mes por estudio (según features)

### Niveles posibles
| Plan | Target | Features |
|------|--------|----------|
| Starter | Abogado solo | Expedientes + vencimientos + tareas. Sin equipo. |
| Pro | 2-10 abogados | Todo + equipo + honorarios + documentos + Google Calendar |
| Studio | 10+ abogados | Todo + reportes + portal cliente + API |

---

## Línea 2 — Inteligencia de mercado (el insight del amigo)

El conocimiento agregado anonimizado es un activo que se puede monetizar separado del SaaS.

### 2A — Benchmarks para estudios (B2B2B)
**Producto:** "LexCore Insights" — dashboard de benchmarks del mercado
**Quién paga:** los mismos estudios suscriptores, en un plan premium
**Qué ven:**
- "Tu tiempo promedio de cobro: 45 días. Mercado Córdoba: 38 días."
- "Tus honorarios en laboral están un 20% por debajo del promedio de estudios similares."
- "El Juzgado N°5 Civil tarda 40% más que el promedio en dictar sentencia."

**Por qué funciona:** el abogado no tiene forma de saber si está cobrando bien, si es lento, si sus clientes son más morosos que el promedio. Este dato vale.

### 2B — Reportes para Colegios de Abogados
**Producto:** reporte anual del estado del ejercicio profesional en la provincia
**Quién paga:** Colegio de Abogados de Córdoba, CPACF u otros colegios
**Qué contiene:** distribución de honorarios, tipos de casos más frecuentes, evolución de la carga de trabajo, mortalidad de estudios, etc.
**Precio:** contrato anual, precio institucional

### 2C — Datos para aseguradoras (responsabilidad profesional)
**Producto:** scoring de riesgo de estudios para seguros de mala praxis
**Quién paga:** aseguradoras que venden seguros de responsabilidad profesional a abogados
**Qué aporta LexCore:** tasa de vencimientos perdidos, cantidad de expedientes activos vs capacidad, tiempo promedio de respuesta del equipo
**Nota:** requiere consentimiento explícito del estudio. Alta fricción regulatoria.

---

## Línea 3 — Portal cliente (B2B2C)

**Concepto:** cada estudio tiene un portal blanco donde sus clientes pueden:
- Ver el estado de su expediente
- Recibir notificaciones de novedades
- Descargar documentos
- Ver cuánto deben de honorarios

**Quién paga:** el estudio paga más (plan superior) para ofrecer esto a sus clientes
**Por qué es diferencial:** hoy los clientes llaman al abogado para saber "cómo va mi causa". Eso es tiempo no facturable. El portal lo elimina.
**Decisión PO:** en plan base → a evaluar en Sprint 10

---

## Línea 4 — Redacción asistida con IA

**Concepto:** el sistema conoce el expediente (partes, fuero, juzgado, historial de movimientos) y puede pre-generar escritos jurídicos.
**Ejemplos:**
- "Generá un escrito de contestación de demanda para este expediente"
- "Redactá una carta documento para este cliente"
- "Resumí los últimos 10 movimientos en lenguaje para el cliente"

**Modelo de monetización:** créditos de IA por encima del plan base (como Cursor o Notion AI)
**Riesgo:** calidad jurídica — el abogado necesita revisar siempre. Hay que dejar claro que es un asistente, no un sustituto.
**Ventaja competitiva:** los modelos genéricos (ChatGPT) no conocen el expediente. LexCore sí.

---

## Línea 5 — Marketplace de servicios jurídicos (largo plazo)

**Concepto:** cuando LexCore tiene suficientes estudios, puede ser el intermediario entre:
- Estudios que buscan corresponsales en otras ciudades
- Peritos que buscan trabajo de estudios
- Abogados jóvenes que buscan pasantías

**Modelo:** comisión o suscripción premium para aparecer en el directorio
**Por qué LexCore puede hacerlo:** ya tiene los datos de qué estudios existen, en qué fueros operan y cuál es su carga de trabajo

---

## Línea 6 — Formación y certificación

**Concepto:** LexCore sabe qué problemas tienen los abogados en el día a día. Puede crear contenido formativo específico y certificarlo.
**Ejemplos:**
- Curso "Gestión de honorarios: cómo cobrar mejor"
- Webinars de mejores prácticas según datos reales del mercado
- Comunidad de abogados LexCore

**Modelo:** freemium o bundle con plan Pro

---

## Perfiles de usuario reales analizados

### Sofía — Abogada sola, civil y familia
**Pain #1:** no sabe cuánto le deben exactamente sin calcular
**Pain #2:** pierde plazos por no tener agenda centralizada
**Willingness to pay:** baja-media (USD 20-30/mes máximo)
**Feature que la engancha:** resumen de deuda por cliente en dashboard

### Marcelo — Socio estudio mediano, laboral
**Pain #1:** no puede supervisar a su equipo sin interrumpirlos
**Pain #2:** necesita acceso mobile en audiencias
**Willingness to pay:** media-alta (USD 50-80/mes)
**Feature que lo engancha:** vista de equipo con estado de cada expediente

### Laura — Penal, clientes de bajos recursos
**Pain #1:** coordinación con tribunal y seguimiento de audiencias
**Pain #2:** no necesita facturación — necesita timeline claro
**Willingness to pay:** baja (USD 15-25/mes)
**Feature que la engancha:** timeline de expediente + vencimientos

### Diego — Estudio grande, societario
**Pain #1:** justificar honorarios con reporte de trabajo
**Pain #2:** sus clientes quieren visibilidad sin llamarlo
**Willingness to pay:** alta (USD 80-150/mes)
**Feature que lo engancha:** portal cliente + reportes de actividad

---

## Estrategia go-to-market Córdoba

1. **Distribución inicial:** red de conocidos + LinkedIn abogados Córdoba
2. **Ancla institucional:** acuerdo con Colegio de Abogados de Córdoba (logo + mailing a socios)
3. **Caso de estudio:** 3 estudios piloto gratis a cambio de testimonial y feedback
4. **Diferenciador vs competencia:** hecho en Argentina, precio en pesos, soporte en español, entiende el sistema judicial argentino

### Competencia a analizar
- **Gestión Jurídica** (argentino, viejo, UX pésima)
- **Clio** (líder global, caro, no adaptado al mercado local)
- **Excel + WhatsApp** (el competidor real — gratis y familiar)

**El enemy statement:** "Dejar de gestionar tus expedientes en Excel y WhatsApp."

---

## Ideas sueltas (sin desarrollar)

- Sistema de alertas por WhatsApp (Twilio) — canal donde ya viven los abogados
- Integración con MEV (Mesa de Entradas Virtual de Córdoba) — scraping o API oficial
- Timesheets por expediente para cobrar por hora además de por causa
- Firma digital de documentos desde la plataforma
- Exportación automática de informes para presentar al cliente en reunión
- "LexCore para el cliente" — app lite para que el cliente vea su expediente desde el teléfono

---

## Principio guía

> El negocio principal es hacer la vida del abogado más fácil.
> El negocio secundario es que LexCore sabe cosas que nadie más sabe.
> El negocio terciario es conectar el ecosistema jurídico con esa inteligencia.
