#  Echo Walker
> *Navega lo invisible. Escucha tu camino.*

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Web Audio API](https://img.shields.io/badge/Web_Audio_API-333333?style=for-the-badge&logo=audio-technica&logoColor=white)
![WCAG 2.1](https://img.shields.io/badge/WCAG_2.1-AA%2FAAA-green?style=for-the-badge)
![Accessibility](https://img.shields.io/badge/Accessibility-100%25-blue?style=for-the-badge&logo=accessibility&logoColor=white)

---

##  Sobre el Proyecto

**Echo Walker** no es solo un juego; es un experimento de ingeniería de software enfocado en la **accesibilidad universal**. Diseñado para romper barreras, este proyecto gamifica la navegación espacial auditiva, permitiendo a usuarios con discapacidad visual o motora experimentar la inmersión de un laberinto complejo sin necesidad de ver la pantalla.

Utilizando tecnologías web nativas de vanguardia, Echo Walker demuestra que la inclusión no es una "característica extra", sino el núcleo del diseño moderno.

##  Público Objetivo

Este proyecto fue construido pensando en:

*   ** Usuarios con Discapacidad Visual (Ciegos):** Navegación completa mediante **Audio 3D Binaural** y lectores de pantalla (NVDA/JAWS).
*   ** Usuarios con Baja Visión:** Temas de **Alto Contraste** (Amarillo/Negro) y tipografía escalable.
*   ** Usuarios con Discapacidad Motora:** Control total "Manos Libres" mediante **Comandos de Voz**.

##  Características Técnicas (The 'Wow' Factor)

Este proyecto destaca por su implementación técnica sin dependencias externas:

###  Motor de Audio 3D (Web Audio API)
Implementación personalizada de StereoPannerNode. El sonido cambia dinámicamente de izquierda a derecha según la posición relativa de la meta, creando un mapa mental sonoro para el usuario.

###  Generación Procedural de Laberintos
Algoritmo **Recursive Backtracker** con lógica de "Braiding" (bucles).
*   *Resultado:* Niveles infinitos y únicos. Nunca jugarás el mismo laberinto dos veces.

###  Control por Voz (Web Speech API)
Integración nativa de reconocimiento de voz. El jugador puede decir *"Norte"*, *"Poner Bandera"* o *"Ayuda"* para interactuar con el juego sin tocar el teclado.

###  Feedback Háptico (Vibration API)
Patrones de vibración específicos para colisiones (golpe seco), banderas (pulsos cortos) y victoria (patrón rítmico), proporcionando una capa táctil de información.

###  Motor de Temas CSS
Variables CSS (:root) dinámicas que permiten el cambio instantáneo entre modos visuales:
*   **Normal:** Estándar.
*   **Alto Contraste:** Negro/Amarillo (WCAG AAA).
*   **Papel:** Crema/Gris (Dyslexia friendly).

##  Controles

| Acción | Teclado  | Voz  |
| :--- | :--- | :--- |
| **Moverse** | Flechas Direccionales | "Arriba", "Abajo", "Izquierda", "Derecha" / "Norte", "Sur"... |
| **Poner Bandera** | Espacio | "Poner bandera", "Bandera" |
| **Consultar Banderas** | F | "Cuántas quedan" |
| **Ayuda / Pánico** | H | "Ayuda", "Pista", "¿Dónde está la meta?" |
| **Música** | M | - |

##  Instalación y Uso

Este proyecto utiliza APIs modernas del navegador.

1.  **Clonar el repositorio:**
    `ash
    git clone https://github.com/jeremyja28/Juego_inclusivo.git
    ` 
2.  **Ejecutar:**
    Debido a las políticas de seguridad del navegador (CORS) para la API de Voz y Audio, es necesario ejecutar el proyecto en un servidor local.
    *   Si usas VS Code: Instala la extensión **Live Server** y haz clic en "Go Live".
    *   O usa Python: python -m http.server 

3.  **¡Jugar!** Abre tu navegador (se recomienda Edge o Chrome para mejor soporte de Voz).

##  Cumplimiento Normativo

Echo Walker ha sido auditado para cumplir con los estándares **WCAG 2.1 Nivel AA y AAA**:
*   Semántica HTML5 correcta (
ole="application", ria-label, ria-live).
*   Contraste de color superior a 7:1 en modo Alto Contraste.
*   Soporte para prefers-reduced-motion.
*   Navegable 100% por teclado.

---
Hecho con  y mucho código.
