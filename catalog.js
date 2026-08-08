/* Catálogo de cursos (código -> nombre, créditos, ciclo) según la malla curricular.
   Se usa para completar automáticamente los créditos al agregar un bloque. */
const COURSE_CATALOG = {
  "AA215": {
    "nombre": "GEOLOGÍA",
    "creditos": 3,
    "ciclo": 1
  },
  "BIC01": {
    "nombre": "INTRODUCCIÓN A LA COMPUTACIÓN",
    "creditos": 2,
    "ciclo": 1
  },
  "BMA01": {
    "nombre": "CÁLCULO DIFERENCIAL",
    "creditos": 5,
    "ciclo": 1
  },
  "BMA03": {
    "nombre": "ÁLGEBRA LINEAL",
    "creditos": 4,
    "ciclo": 1
  },
  "BQU01": {
    "nombre": "QUÍMICA I",
    "creditos": 5,
    "ciclo": 1
  },
  "BRC01": {
    "nombre": "REDACCIÓN Y COMUNICACIÓN",
    "creditos": 2,
    "ciclo": 1
  },
  "AA237": {
    "nombre": "DIBUJO TÉCNICO",
    "creditos": 2,
    "ciclo": 2
  },
  "BEG01": {
    "nombre": "ECONOMÍA GENERAL",
    "creditos": 3,
    "ciclo": 2
  },
  "BFI01": {
    "nombre": "FÍSICA I",
    "creditos": 5,
    "ciclo": 2
  },
  "BMA02": {
    "nombre": "CÁLCULO INTEGRAL",
    "creditos": 5,
    "ciclo": 2
  },
  "SA312": {
    "nombre": "ECOLOGÍA",
    "creditos": 2,
    "ciclo": 2
  },
  "SA401": {
    "nombre": "QUÍMICA SANITARIA",
    "creditos": 3,
    "ciclo": 2
  },
  "AA232": {
    "nombre": "BIOESTADÍSTICA",
    "creditos": 4,
    "ciclo": 3
  },
  "AA234": {
    "nombre": "FÍSICA II",
    "creditos": 4,
    "ciclo": 3
  },
  "AA241": {
    "nombre": "CÁLCULO MULTIVARIABLE",
    "creditos": 4,
    "ciclo": 3
  },
  "AA243": {
    "nombre": "FÍSICO-QUÍMICA APLICADA",
    "creditos": 3,
    "ciclo": 3
  },
  "BEF01": {
    "nombre": "ÉTICA Y FILOSOFÍA POLÍTICA",
    "creditos": 2,
    "ciclo": 3
  },
  "SA323": {
    "nombre": "MICROBIOLOGÍA SANITARIA I",
    "creditos": 5,
    "ciclo": 3
  },
  "BRN01": {
    "nombre": "REALIDAD NACIONAL, CONSTITUCIÓN Y DERECHOS HUMANOS",
    "creditos": 3,
    "ciclo": 4
  },
  "EC115": {
    "nombre": "MECÁNICA DEL CUERPO RÍGIDO",
    "creditos": 4,
    "ciclo": 4
  },
  "FI413": {
    "nombre": "FÍSICA III",
    "creditos": 3,
    "ciclo": 4
  },
  "MA153": {
    "nombre": "ECUACIONES DIFERENCIALES",
    "creditos": 4,
    "ciclo": 4
  },
  "SA324": {
    "nombre": "MICROBIOLOGÍA SANITARIA II",
    "creditos": 3,
    "ciclo": 4
  },
  "SA343": {
    "nombre": "EPIDEMIOLOGÍA Y SALUD PÚBLICA",
    "creditos": 3,
    "ciclo": 4
  },
  "AA235": {
    "nombre": "TOPOGRAFÍA",
    "creditos": 4,
    "ciclo": 5
  },
  "EC125": {
    "nombre": "RESISTENCIA DE MATERIALES",
    "creditos": 5,
    "ciclo": 5
  },
  "HH223": {
    "nombre": "MECÁNICA DE FLUIDOS I",
    "creditos": 4,
    "ciclo": 5
  },
  "SA413": {
    "nombre": "ANÁLISIS DE AGUA Y DESAGÜE",
    "creditos": 6,
    "ciclo": 5
  },
  "SA467": {
    "nombre": "MANEJO Y TRATAMIENTO DE RESIDUOS SÓLIDOS",
    "creditos": 3,
    "ciclo": 5
  },
  "BIE01": {
    "nombre": "IDIOMA EXTRANJERO O LENGUA NATIVA EN NIVEL INTERMEDIO",
    "creditos": 2,
    "ciclo": 6
  },
  "EC611": {
    "nombre": "TECNOLOGÍA DE MATERIALES",
    "creditos": 4,
    "ciclo": 6
  },
  "HH113": {
    "nombre": "HIDROLOGÍA GENERAL",
    "creditos": 3,
    "ciclo": 6
  },
  "HH224": {
    "nombre": "MECÁNICA DE FLUIDOS II",
    "creditos": 4,
    "ciclo": 6
  },
  "SA426": {
    "nombre": "PROCESOS UNITARIOS EN INGENIERÍA SANITARIA I",
    "creditos": 4,
    "ciclo": 6
  },
  "SA468": {
    "nombre": "INGENIERÍA DE RESIDUOS HOSPITALARIOS Y PELIGROSOS",
    "creditos": 3,
    "ciclo": 6
  },
  "EC411": {
    "nombre": "ANÁLISIS Y DISEÑO DE ESTRUCTURAS HIDRÁULICAS",
    "creditos": 5,
    "ciclo": 7
  },
  "EE631": {
    "nombre": "INSTALACIONES ELÉCTRICAS Y AUTOMATIZACIÓN",
    "creditos": 3,
    "ciclo": 7
  },
  "SA116": {
    "nombre": "SANEAMIENTO RURAL",
    "creditos": 4,
    "ciclo": 7
  },
  "SA227": {
    "nombre": "APROVECHAMIENTO DE AGUAS SUBTERRÁNEAS",
    "creditos": 4,
    "ciclo": 7
  },
  "SA427": {
    "nombre": "PROCESOS UNITARIOS EN INGENIERÍA SANITARIA II",
    "creditos": 3,
    "ciclo": 7
  },
  "EC717": {
    "nombre": "PROCEDIMIENTOS DE CONSTRUCCIÓN",
    "creditos": 4,
    "ciclo": 8
  },
  "SA126": {
    "nombre": "SANEAMIENTO AMBIENTAL",
    "creditos": 4,
    "ciclo": 8
  },
  "SA215": {
    "nombre": "ABASTECIMIENTO DE AGUA I",
    "creditos": 4,
    "ciclo": 8
  },
  "SA516": {
    "nombre": "INSTALACIONES SANITARIAS EN EDIFICACIONES",
    "creditos": 4,
    "ciclo": 8
  },
  "SA526": {
    "nombre": "MÁQUINAS Y EQUIPOS SANITARIOS",
    "creditos": 3,
    "ciclo": 8
  },
  "SA216": {
    "nombre": "ABASTECIMIENTO DE AGUA II",
    "creditos": 4,
    "ciclo": 9
  },
  "SA245": {
    "nombre": "ALCANTARILLADO Y DRENAJE PLUVIAL",
    "creditos": 4,
    "ciclo": 9
  },
  "SA445": {
    "nombre": "TRATAMIENTO DE AGUA I",
    "creditos": 4,
    "ciclo": 9
  },
  "SA465": {
    "nombre": "TRATAMIENTO DE DESAGÜES",
    "creditos": 4,
    "ciclo": 9
  },
  "SA517": {
    "nombre": "INSTALACIONES SANITARIAS ESPECIALES",
    "creditos": 3,
    "ciclo": 9
  },
  "BAE01": {
    "nombre": "ACTIVIDADES EXTRACURRICULARES",
    "creditos": 1,
    "ciclo": 10
  },
  "SA235": {
    "nombre": "ANÁLISIS DE REDES Y FUENTES DE AGUA",
    "creditos": 3,
    "ciclo": 10
  },
  "SA363": {
    "nombre": "TALLER DE INVESTIGACIÓN",
    "creditos": 3,
    "ciclo": 10
  },
  "SA446": {
    "nombre": "TRATAMIENTO DE AGUA II",
    "creditos": 4,
    "ciclo": 10
  },
  "SA475": {
    "nombre": "TRATAMIENTO AVANZADO DE AGUAS RESIDUALES",
    "creditos": 3,
    "ciclo": 10
  },
  "SA921": {
    "nombre": "EVALUACIÓN DEL IMPACTO AMBIENTAL",
    "creditos": 3,
    "ciclo": 10
  },
  "SXP200": {
    "nombre": "PRÁCTICAS PRE-PROFESIONALES II",
    "creditos": 2,
    "ciclo": 10
  },
  "AA214": {
    "nombre": "RECURSOS NATURALES",
    "creditos": 2,
    "ciclo": null
  },
  "SAU411": {
    "nombre": "PLANEAMIENTO URBANO Y REGIONAL",
    "creditos": 3,
    "ciclo": null
  },
  "PA135": {
    "nombre": "PROGRAMACIÓN DE OBRAS",
    "creditos": 3,
    "ciclo": null
  },
  "SA135": {
    "nombre": "HIGIENE ALIMENTARIA",
    "creditos": 4,
    "ciclo": null
  },
  "SA172": {
    "nombre": "CONTAMINACIÓN AMBIENTAL",
    "creditos": 4,
    "ciclo": null
  },
  "SA266": {
    "nombre": "TARIFAS EN INGENIERÍA SANITARIA",
    "creditos": 4,
    "ciclo": null
  },
  "SA275": {
    "nombre": "OPERACIONES, MANTENIMIENTO Y GERENCIA DE PROYECTOS",
    "creditos": 4,
    "ciclo": null
  },
  "SA447": {
    "nombre": "TRATAMIENTO AVANZADO DE AGUA POTABLE",
    "creditos": 3,
    "ciclo": null
  },
  "SA466": {
    "nombre": "TRATAMIENTO DE DESECHOS INDUSTRIALES",
    "creditos": 3,
    "ciclo": null
  },
  "SA818": {
    "nombre": "COSTOS Y PRESUPUESTOS",
    "creditos": 3,
    "ciclo": null
  },
  "SA828": {
    "nombre": "SUPERVISIÓN DE OBRAS",
    "creditos": 4,
    "ciclo": null
  },
  "SA923": {
    "nombre": "PREVENCIÓN CONTRA DESASTRES NATURALES",
    "creditos": 2,
    "ciclo": null
  },
  "SSE222": {
    "nombre": "SEGURIDAD E HIGIENE EN ACTIVIDADES DE PESQUERÍA",
    "creditos": 3,
    "ciclo": null
  },
  "SXA100": {
    "nombre": "ACTIVIDADES DIVERSAS I",
    "creditos": 1,
    "ciclo": null
  },
  "SYA100": {
    "nombre": "AYUDANTÍA ACADÉMICA I",
    "creditos": 1,
    "ciclo": null
  }
};
