/* pages/tools/color-blind-2/color-blind.js — Edukasi Warna: Buta Warna Parsial & Pencampuran Warna
 * Konversi dari tools/color-blind/index.html ke module SPA.
 * Partikel background dihilangkan; dark mode mengikuti tema aplikasi. */
import { createEl } from '../../../utils/dom.js';

const CSS = `
        :root {
            --background-color: #f0f0f0;
            --text-color: #333;
            --container-bg: #fff;
            --card-bg: #ffffff;
            --card-border: #ddd;
            --input-border: #ccc;
            --button-bg: #007bff;
            --button-text: #fff;
            --button-hover-bg: #0056b3;
            --color-box-border: #888;
            --input-text-bg: #eee; /* Slightly different background for text input */
            --list-marker-color: #007bff; /* Color for list bullet points */
            --item-bg-light: #f9f9f9; /* Background for individual color items */
        }

        .cb-root {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: var(--background-color);
            color: var(--text-color);
            transition: background-color 0.3s ease, color 0.3s ease;
            overflow-x: hidden; /* Prevent horizontal scroll */
        }

        .cb-root.dark-mode {
            --background-color: #1a1a2e;
            --text-color: #e0e0e0;
            --container-bg: #16213e;
            --card-bg: #0f3460;
            --card-border: #0a2b4c;
            --input-border: #0d3054;
            --button-bg: #e94560;
            --button-text: #fff;
            --button-hover-bg: #d5344d;
            --color-box-border: #bbb;
            --input-text-bg: #0d3054; /* Match input border for dark mode */
            --list-marker-color: #e94560; /* Color for list bullet points in dark mode */
            --item-bg-light: #1a3f6b; /* Background for individual color items */
        }

        

        .container {
            max-width: 900px;
            margin: 20px auto;
            padding: 20px; /* Default padding */
            background-color: var(--container-bg);
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            position: relative; /* Needed for z-index to be above particles */
            z-index: 1;
             box-sizing: border-box; /* Include padding in width */
        }

        h1, h2, h3 {
            color: var(--text-color);
        }
        h2 {
            border-bottom: 2px solid var(--card-border);
            padding-bottom: 10px;
            margin-top: 20px;
        }
         h3 {
             margin-top: 15px;
             margin-bottom: 10px;
             padding-bottom: 5px;
             border-bottom: 1px dashed var(--card-border);
         }


        .card {
            background-color: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
            box-shadow: 0 1px 5px rgba(0, 0, 0, 0.05);
        }

        /* Styles for the new color box lists */
        .color-list-section .row {
            display: flex; /* Use flexbox for horizontal layout and wrapping */
            flex-wrap: wrap; /* Allow items to wrap to the next line */
            gap: 10px; /* Space between color boxes */
            margin-top: 15px;
            justify-content: center; /* Center items in the row */
        }

        .color-list-section .color-box {
            width: 100px; /* Fixed width for each box */
            height: 100px; /* Fixed height */
            padding: 8px; /* Padding inside the box */
            border: 1px solid var(--color-box-border);
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            color: white; /* Default text color for dark backgrounds */
            font-size: 0.9em;
            display: flex; /* Use flexbox within the box */
            flex-direction: column; /* Stack content vertically */
            justify-content: center; /* Center content vertically */
            align-items: center; /* Center content horizontally */
             word-break: break-word; /* Break long words if necessary */
             text-align: center; /* Ensure text is centered */
        }

        .color-list-section .color-box.black-text {
            color: black; /* Specific class for black text on light backgrounds */
        }

         .color-list-section .color-box .color-hex {
             display: block; /* Ensure hex code is on a new line */
             font-size: 0.8em; /* Smaller font size for hex code */
             opacity: 0.8; /* Slightly transparent */
             margin-top: 3px; /* Space above hex code */
         }
         .cb-root.dark-mode .color-list-section .color-box .color-hex {
             color: #eee; /* Lighter hex code in dark mode */
         }


        /* Style for the Tips list (keeping it as a standard bulleted list) */
        .color-list-section .tips-list {
             list-style-type: disc;
             padding-left: 20px;
             margin-top: 20px; /* Add space above the tips list */
         }

          .color-list-section .tips-list li {
             background-color: var(--input-text-bg);
             border: 1px solid var(--input-border);
             margin-bottom: 8px;
             padding: 10px;
             border-radius: 4px;
             position: relative; /* Needed for ::before positioning */
             padding-left: 30px; /* Increased padding for bullet point */
         }

          .color-list-section .tips-list li::before {
              content: "\\2022"; /* Unicode character for bullet */
              color: var(--list-marker-color);
              display: inline-block;
              width: 1em;
              margin-left: -1em;
              position: absolute;
              left: 15px; /* Adjust left position */
              top: 50%; /* Center vertically */
              transform: translateY(-50%);
         }

           /* Ensure text in tips list flows correctly */
           .color-list-section .tips-list li strong,
           .color-list-section .tips-list li span,
           .color-list-section .tips-list li .color-box-small {
               display: inline-block; /* Ensure these elements stay inline or inline-block */
               vertical-align: middle; /* Align vertically */
               margin-right: 5px; /* Small space after inline elements */
           }
             .color-list-section .tips-list li .color-box-small {
                 width: 20px; /* Keep small size */
                 height: 20px;
                 border: 1px solid var(--color-box-border); /* Added border for visibility */
                 margin-right: 10px;
             }
            .color-list-section .tips-list li strong {
                font-weight: bold;
            }
             .color-list-section .tips-list li p { /* Target any potential paragraph inside tips list item */
                 display: inline;
                 margin: 0;
                 padding: 0;
             }

        /* Add styles for the WCAG list (explaining AA/AAA levels) */
        .color-list-section .wcag-list {
             list-style-type: disc;
             padding-left: 20px;
             margin-top: 10px;
             margin-bottom: 15px;
        }

        .color-list-section .wcag-list li {
             margin-bottom: 8px;
              /* Reset list item styling from tips-list */
             background-color: transparent;
             border: none;
             padding: 0;
             position: static;
             padding-left: 0; /* Remove padding-left added for tips list bullet */
        }
        /* Re-add bullet point for wcag-list using ::before */
         .color-list-section .wcag-list li::before {
              content: "\\2022"; /* Unicode character for bullet */
              color: var(--list-marker-color);
              display: inline-block;
              width: 1em;
              margin-left: -1em;
              position: relative; /* Use relative positioning */
              left: auto; /* Reset absolute position */
              top: auto; /* Reset vertical center */
              transform: none; /* Reset transform */
         }


        /* Styles for WCAG contrast examples grid */
        .color-list-section .contrast-examples-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); /* Responsive columns */
            gap: 15px; /* Space between items */
            margin-top: 15px;
            padding: 0;
            list-style: none; /* Ensure no list style */
            justify-items: center; /* Center items within their grid area */
        }

        .color-list-section .contrast-example-box {
            width: 150px; /* Fixed width */
            height: 120px; /* Fixed height */
            padding: 10px;
            border: 1px solid var(--card-border); /* Use card border */
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            display: flex;
            flex-direction: column;
            justify-content: center; /* Center all flex items vertically */
            align-items: center; /* Center all flex items horizontally */
            text-align: center;
            font-size: 0.9em; /* Base font size */
             box-sizing: border-box; /* Include padding/border in size */
        }

        .color-list-section .contrast-example-box .sample-text {
            display: block; /* Ensure sample text is on its own line */
            font-weight: bold;
            margin-bottom: 5px;
            font-size: 1em; /* Size relative to parent */
        }

        .color-list-section .contrast-example-box .ratio-level {
             display: block; /* Ensure this block is below sample text */
             font-size: 0.85em; /* Smaller size for ratio/level */
             opacity: 0.9; /* Slightly muted */
             line-height: 1.3; /* Adjust line height for ratio/level text */
        }

        .color-list-section .contrast-example-box .ratio-level br {
            /* <br> will work inside the span */
        }

        /* Color Mixing Tool Styles */
        .color-mixer-tool {
            margin-top: 20px;
        }

         .color-mixer-options {
             margin-bottom: 20px;
             padding-bottom: 15px;
             border-bottom: 1px solid var(--card-border);
             display: flex; /* Use flex to align label and select */
             align-items: center;
             flex-wrap: wrap; /* Allow wrapping on small screens */
             gap: 10px; /* Space between items */
         }

         .color-mixer-options label {
             font-weight: bold;
             /* margin-right: 10px; */ /* Gap handles spacing */
         }

         /* Style the custom dropdown */
         .custom-select-wrapper {
             position: relative;
             display: inline-block; /* Or block if you want it on its own line */
             /* width: 150px; */ /* Optional: Give it a specific width */
              flex-grow: 1; /* Allow it to grow in flex container */
              max-width: 200px; /* Max width to prevent it from becoming too wide */
              min-width: 120px; /* Min width */
             box-sizing: border-box;
         }


        #numColorsSelect {
            display: block; /* Make it a block element */
            width: 100%; /* Take full width of wrapper */
            padding: 8px 30px 8px 10px; /* Add padding-right for arrow */
            border: 1px solid var(--input-border);
            border-radius: 4px;
            background-color: var(--card-bg); /* Use card background */
            color: var(--text-color);
            font-size: 1em;
            line-height: 1.5; /* Improve text spacing */
            cursor: pointer;

            /* Hide native dropdown arrow */
            appearance: none;
            -moz-appearance: none;
            -webkit-appearance: none;
            background-image: none; /* Ensure no default background arrow */
            box-sizing: border-box;
        }

        /* Custom dropdown arrow using Font Awesome */
        .custom-select-wrapper::after {
            content: '\\f078'; /* Font Awesome angle-down icon */
            font-family: 'Font Awesome 6 Free';
            font-weight: 900; /* Solid icon */
            position: absolute;
            top: 50%;
            right: 10px; /* Position relative to padding-right */
            transform: translateY(-50%);
            pointer-events: none; /* Allow clicks to pass through to the select */
            color: var(--text-color); /* Inherit text color for icon */
            font-size: 0.8em; /* Adjust size */
        }

        .cb-root.dark-mode .custom-select-wrapper::after {
            color: var(--text-color); /* Ensure icon color updates in dark mode */
        }


        .color-inputs {
            display: grid;
             /* Grid columns will be set by JS based on number of colors, but auto-fit for responsiveness */
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); /* Adjust minmax for input group width */
            gap: 20px;
            margin-bottom: 20px;
        }

         .color-input-container {
             /* This container wraps each color input group and will be shown/hidden */
         }


        .color-input-group {
            border: 1px solid var(--card-border);
            padding: 15px;
            border-radius: 6px;
             height: 100%; /* Ensure groups fill grid cell height */
             box-sizing: border-box;
        }

        .color-input-group h3 {
            margin-top: 0;
            margin-bottom: 10px;
            color: var(--text-color);
        }

        .color-mode-select {
            margin-bottom: 15px;
        }

        .color-mode-select label {
            margin-right: 15px;
        }

        .color-sliders label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .color-sliders input[type="number"] {
            width: calc(100% - 20px); /* Adjust width considering padding */
            padding: 8px 10px;
            margin-bottom: 10px;
            border: 1px solid var(--input-border);
            border-radius: 4px;
            background-color: var(--card-bg); /* Use card background for input */
            color: var(--text-color);
             box-sizing: border-box; /* Include padding/border in width */
        }

         .color-text-input {
            margin-top: 15px;
            border-top: 1px solid var(--card-border);
            padding-top: 15px;
         }

         .color-text-input label {
             display: block;
             margin-bottom: 5px;
             font-weight: bold;
         }

         .color-text-input input[type="text"] {
             width: calc(100% - 20px); /* Adjust width considering padding */
             padding: 8px 10px;
             border: 1px solid var(--input-border);
             border-radius: 4px;
             background-color: var(--input-text-bg); /* Use input text background */
             color: var(--text-color);
              box-sizing: border-box; /* Include padding/border in width */
         }


        .mixer-button {
            display: block;
            width: 100%;
            padding: 10px 15px;
            background-color: var(--button-bg);
            color: var(--button-text);
            border: none;
            border-radius: 4px;
            font-size: 1em;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }

        .mixer-button:hover {
            background-color: var(--button-hover-bg);
        }

        .color-output {
            margin-top: 20px;
            text-align: center;
        }

        .mixed-color-box {
            width: 150px;
            height: 150px;
            margin: 0 auto 15px auto;
            border: 2px solid var(--color-box-border);
            border-radius: 8px;
            box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.2);
        }

        .color-codes p {
            margin: 5px 0;
            font-family: 'Courier New', monospace;
        }

        /* Dark Mode Toggle */
        .dark-mode-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: var(--button-bg);
            color: var(--button-text);
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 1.2em;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10; /* Ensure it's above other content */
            transition: background-color 0.3s ease;
        }

         .dark-mode-toggle:hover {
            background-color: var(--button-hover-bg);
        }

         /* --- Media Queries for Responsiveness --- */
         @media (max-width: 768px) {
            .container {
                padding: 15px; /* Slightly less padding on smaller screens */
            }

            /* Adjustments for color mixer inputs based on count */
             .color-inputs {
                 /* Use auto-fit minmax here as well for smaller screens */
                 grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                 gap: 15px;
             }

             .color-input-group {
                 padding: 12px;
             }


             /* Adjustments for new color box lists */
             .color-list-section .row {
                 gap: 8px; /* Reduce gap */
             }
             .color-list-section .color-box {
                width: 80px; /* Make box smaller */
                height: 80px;
                font-size: 0.8em;
             }
             .color-list-section .color-box .color-hex {
                 font-size: 0.7em;
             }

             /* Adjustments for WCAG boxes */
             .color-list-section .contrast-examples-grid {
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); /* Adjust minmax */
                gap: 10px;
            }
            .color-list-section .contrast-example-box {
                width: 120px; /* Adjust size */
                height: 100px;
                padding: 8px;
                font-size: 0.85em;
            }
             .color-list-section .contrast-example-box .sample-text {
                 font-size: 0.95em;
             }
             .color-list-section .contrast-example-box .ratio-level {
                 font-size: 0.8em;
             }

             /* Adjustments for Tips List */
              .color-list-section .tips-list {
                   padding-left: 15px; /* Adjust padding */
              }
              .color-list-section .tips-list li {
                   padding: 8px; /* Reduce padding */
                    padding-left: 25px; /* Adjust padding for bullet */
             }
              .color-list-section .tips-list li::before {
                 left: 10px; /* Adjust bullet position */
              }
         }

         @media (max-width: 480px) {
              .container {
                  padding: 10px; /* Even less padding on very small screens */
              }
               /* Adjustments for new color box lists */
             .color-list-section .row {
                 gap: 6px; /* Further reduce gap */
             }
             .color-list-section .color-box {
                width: 60px; /* Make box smaller */
                height: 60px;
                font-size: 0.7em;
                padding: 5px;
             }
              .color-list-section .color-box .color-hex {
                 font-size: 0.6em;
             }
             /* Adjustments for WCAG boxes */
             .color-list-section .contrast-examples-grid {
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); /* Adjust minmax */
                gap: 8px;
            }
            .color-list-section .contrast-example-box {
                width: 90px; /* Adjust size */
                height: 80px;
                padding: 5px;
                font-size: 0.7em;
            }
             .color-list-section .contrast-example-box .sample-text {
                 font-size: 0.9em;
             }
             .color-list-section .contrast-example-box .ratio-level {
                 font-size: 0.75em;
             }


              /* Adjustments for Tips List */
             .color-list-section .tips-list {
                   padding-left: 10px; /* Adjust padding */
              }
              .color-list-section .tips-list li {
                    padding-left: 20px; /* Adjust padding for bullet */
              }
              .color-list-section .tips-list li::before {
                 left: 5px; /* Adjust bullet position */
              }

         }


    `;

const BODY = `</head>
<body><div class="container">
        <h1>Edukasi Warna: Memahami Buta Warna Parsial & Pencampuran Warna</h1>

        <div class="card">
            <h2>Penjelasan Singkat Jenis Buta Warna Parsial</h2>
            <p>Buta warna parsial adalah kondisi di mana seseorang memiliki kesulitan dalam membedakan nuansa warna tertentu. Ini paling sering melibatkan kesulitan membedakan warna merah dan hijau, tetapi juga bisa melibatkan biru dan kuning. Berikut beberapa jenis utamanya:</p>
            <ul>
                <li><strong>Protanomali:</strong> Kelemahan terhadap warna merah. Spektrum warna tampaknya kurang merah, dan nuansa merah, oranye, dan kuning mungkin tampak lebih kehijauan dan kurang cerah. Ini yang sering disebut "lemah merah".</li>
                <li><strong>Deuteranomali:</strong> Kelemahan terhadap warna hijau. Ini adalah jenis buta warna paling umum. Spektrum warna tampaknya kurang hijau, dan nuansa merah, oranye, dan kuning mungkin tampak lebih kemerahan. Ini yang sering disebut "lemah hijau".</li>
                <li><strong>Tritanomali:</strong> Kelemahan terhadap warna biru dan kuning. Memiliki kesulitan membedakan biru dari hijau dan kuning dari merah.</li>
                <li><strong>Protanopia:</strong> Bentuk buta warna merah-hijau yang lebih parah, di mana sel kerucut merah tidak berfungsi sama sekali. Merah tampak gelap atau hitam.</li>
                <li><strong>Deuteranopia:</strong> Bentuk buta warna merah-hijau yang lebih parah, di mana sel kerucuk hijau tidak berfungsi sama sekali.</li>
                <li><strong>Tritanopia:</strong> Bentuk buta warna biru-kuning yang lebih parah, di mana sel kerucut biru tidak berfungsi sama sekali. Biru tampak kehijauan, kuning dan merah tampak merah muda.</li>
            </ul>
            <p class="color-weakness-note">Jenis buta warna parsial "lemah hijau" merujuk pada Deuteranomali, sedangkan "lemah merah" merujuk pada Protanomali.</p>
        </div>

        <div class="card color-list-section">
            <h2>Warna Mengandung Hijau (Rentan untuk Lemah Hijau)</h2>
            <div class="row">
              <div class="color-box" style="background:#006400;">DarkGreen<br><span class="color-hex">#006400</span></div>
              <div class="color-box" style="background:#008000;">Green<br><span class="color-hex">#008000</span></div>
              <div class="color-box black-text" style="background:#00FF00;">Lime<br><span class="color-hex">#00FF00</span></div>
              <div class="color-box black-text" style="background:#7FFF00;">Chartreuse<br><span class="color-hex">#7FFF00</span></div>
              <div class="color-box black-text" style="background:#ADFF2F;">GreenYellow<br><span class="color-hex">#ADFF2F</span></div>
              <div class="color-box black-text" style="background:#9ACD32;">YellowGreen<br><span class="color-hex">#9ACD32</span></div>
              <div class="color-box" style="background:#2E8B57;">SeaGreen<br><span class="color-hex">#2E8B57</span></div>
              <div class="color-box black-text" style="background:#20B2AA;">LightSeaGreen<br><span class="color-hex">#20B2AA</span></div>
              <div class="color-box black-text" style="background:#00FA9A;">MediumSpringGreen<br><span class="color-hex">#00FA9A</span></div>
              <div class="color-box black-text" style="background:#00FF7F;">SpringGreen<br><span class="color-hex">#00FF7F</span></div>
              <div class="color-box black-text" style="background:#3CB371;">MediumSeaGreen<br><span class="color-hex">#3CB371</span></div>
              <div class="color-box" style="background:#228B22;">ForestGreen<br><span class="color-hex">#228B22</span></div>
              <div class="color-box" style="background:#2F4F4F;">DarkSlateGray<br><span class="color-hex">#2F4F4F</span></div>
              <div class="color-box" style="background:#008B8B;">DarkCyan<br><span class="color-hex">#008B8B</span></div>
              <div class="color-box black-text" style="background:#40E0D0;">Turquoise<br><span class="color-hex">#40E0D0</span></div>
              <div class="color-box black-text" style="background:#48D1CC;">MediumTurquoise<br><span class="color-hex">#48D1CC</span></div>
              <div class="color-box black-text" style="background:#AFEEEE;">PaleTurquoise<br><span class="color-hex">#AFEEEE</span></div>
              <div class="color-box black-text" style="background:#00CED1;">DarkTurquoise<br><span class="color-hex">#00CED1</span></div>
            </div>

            <h2>Warna Mengandung Merah (Rentan untuk Lemah Merah)</h2>
            <div class="row">
              <div class="color-box" style="background:#8B0000;">DarkRed<br><span class="color-hex">#8B0000</span></div>
              <div class="color-box" style="background:#A52A2A;">Brown<br><span class="color-hex">#A52A2A</span></div>
              <div class="color-box" style="background:#B22222;">FireBrick<br><span class="color-hex">#B22222</span></div>
              <div class="color-box black-text" style="background:#DC143C;">Crimson<br><span class="color-hex">#DC143C</span></div>
              <div class="color-box black-text" style="background:#FF0000;">Red<br><span class="color-hex">#FF0000</span></div>
              <div class="color-box black-text" style="background:#FF6347;">Tomato<br><span class="color-hex">#FF6347</span></div>
              <div class="color-box black-text" style="background:#FF4500;">OrangeRed<br><span class="color-hex">#FF4500</span></div>
              <div class="color-box black-text" style="background:#FA8072;">Salmon<br><span class="color-hex">#FA8072</span></div>
              <div class="color-box black-text" style="background:#E9967A;">DarkSalmon<br><span class="color-hex">#E9967A</span></div>
              <div class="color-box black-text" style="background:#F08080;">LightCoral<br><span class="color-hex">#F08080</span></div>
              <div class="color-box black-text" style="background:#CD5C5C;">IndianRed<br><span class="color-hex">#CD5C5C</span></div>
              <div class="color-box black-text" style="background:#FF7F50;">Coral<br><span class="color-hex">#FF7F50</span></div>
              <div class="color-box black-text" style="background:#FFDAB9;">PeachPuff<br><span class="color-hex">#FFDAB9</span></div>
              <div class="color-box black-text" style="background:#FFE4E1;">MistyRose<br><span class="color-hex">#FFE4E1</span></div>
              <div class="color-box black-text" style="background:#FFF0F5;">LavenderBlush<br><span class="color-hex">#FFF0F5</span></div>
              <div class="color-box" style="background:#800000;">Maroon<br><span class="color-hex">#800000</span></div>
            </div>

            <h2>Warna Mengandung Biru (Rentan untuk Lemah Biru / Tritanomaly)</h2>
            <div class="row">
              <div class="color-box" style="background:#00008B;">DarkBlue<br><span class="color-hex">#00008B</span></div>
              <div class="color-box" style="background:#0000CD;">MediumBlue<br><span class="color-hex">#0000CD</span></div>
              <div class="color-box" style="background:#0000FF;">Blue<br><span class="color-hex">#0000FF</span></div>
              <div class="color-box black-text" style="background:#1E90FF;">DodgerBlue<br><span class="color-hex">#1E90FF</span></div>
              <div class="color-box" style="background:#4169E1;">RoyalBlue<br><span class="color-hex">#4169E1</span></div>
              <div class="color-box black-text" style="background:#4682B4;">SteelBlue<br><span class="color-hex">#4682B4</span></div>
              <div class="color-box black-text" style="background:#5F9EA0;">CadetBlue<br><span class="color-hex">#5F9EA0</span></div>
              <div class="color-box black-text" style="background:#87CEEB;">SkyBlue<br><span class="color-hex">#87CEEB</span></div>
              <div class="color-box black-text" style="background:#87CEFA;">LightSkyBlue<br><span class="color-hex">#87CEFA</span></div>
              <div class="color-box black-text" style="background:#ADD8E6;">LightBlue<br><span class="color-hex">#ADD8E6</span></div>
              <div class="color-box black-text" style="background:#B0C4DE;">LightSteelBlue<br><span class="color-hex">#B0C4DE</span></div>
              <div class="color-box black-text" style="background:#6495ED;">CornflowerBlue<br><span class="color-hex">#6495ED</span></div>
              <div class="color-box black-text" style="background:#00BFFF;">DeepSkyBlue<br><span class="color-hex">#00BFFF</span></div>
              <div class="color-box black-text" style="background:#1C86EE;">DodgerBlue2<br><span class="color-hex">#1C86EE</span></div>
            </div>

            <h2>Warna Aman untuk Penglihatan Buta Warna Parsial</h2>
            <div class="row">
              <div class="color-box" style="background:#000000;">Hitam<br><span class="color-hex">#000000</span></div>
              <div class="color-box black-text" style="background:#FFFFFF;">Putih<br><span class="color-hex">#FFFFFF</span></div>
              <div class="color-box" style="background:#808080;">Abu-abu<br><span class="color-hex">#808080</span></div>
              <div class="color-box" style="background:#800080;">Ungu<br><span class="color-hex">#800080</span></div>
              <div class="color-box" style="background:#4B0082;">Indigo<br><span class="color-hex">#4B0082</span></div>
              <div class="color-box black-text" style="background:#FFA500;">Oranye<br><span class="color-hex">#FFA500</span></div>
              <div class="color-box" style="background:#D2691E;">Chocolate<br><span class="color-hex">#D2691E</span></div>
              <div class="color-box black-text" style="background:#A9A9A9;">DarkGray<br><span class="color-hex">#A9A9A9</span></div>
            </div>

            <h2>Rekomendasi Kontras Warna Berdasarkan WCAG</h2>
            <p>Untuk memastikan teks dan elemen grafis mudah dibaca oleh semua orang, termasuk pengguna dengan buta warna atau penglihatan rendah, Web Content Accessibility Guidelines (WCAG) menetapkan persyaratan kontras warna.</p>
            <p>Kontras warna diukur dengan rasio antara luminansi (kecerahan) warna latar belakang dan warna teks/elemen di atasnya. Rasio ini berkisar dari 1:1 (tanpa kontras, misal putih di atas putih) hingga 21:1 (kontras maksimal, misal hitam di atas putih).</p>
            <p>WCAG memiliki dua level utama untuk kontras:</p>
            <ul class="wcag-list"> <li><strong>Level AA:</strong> Rasio kontras minimal <strong>4.5:1</strong> untuk teks normal, dan <strong>3:1</strong> untuk teks besar (minimal 18pt atau 24px, atau 14pt/18.66px tebal) serta elemen grafis penting.</li>
                <li><strong>Level AAA (Enhanced):</strong> Rasio kontras minimal <strong>7:1</strong> untuk teks normal, dan <strong>4.5:1</strong> untuk teks besar.</li>
            </ul>
            <p>Memenuhi level AA adalah persyaratan umum, sementara level AAA memberikan aksesibilitas yang lebih baik.</p>

            <h3>Contoh Pasangan Warna dengan Kontras yang Baik</h3>
            <div class="contrast-examples-grid">
                <div class="contrast-example-box" style="background:#FFFFFF; color:#000000;">
                    <span class="sample-text">Teks Normal</span>
                    <span class="ratio-level">Rasio: 21:1<br>Level: AAA</span>
                </div>
                <div class="contrast-example-box" style="background:#000000; color:#FFFFFF;">
                    <span class="sample-text">Teks Normal</span>
                    <span class="ratio-level">Rasio: 21:1<br>Level: AAA</span>
                </div>
                 <div class="contrast-example-box" style="background:#000080; color:#FFFFFF;">
                    <span class="sample-text">Teks Normal</span>
                    <span class="ratio-level">Rasio: 8.6:1<br>Level: AAA</span>
                </div>
                <div class="contrast-example-box" style="background:#006400; color:#FFFFFF;">
                    <span class="sample-text">Teks Normal</span>
                    <span class="ratio-level">Rasio: 8.2:1<br>Level: AAA</span>
                </div>
                <div class="contrast-example-box" style="background:#EEEEEE; color:#555555;">
                    <span class="sample-text">Teks Normal</span>
                    <span class="ratio-level">Rasio: 4.5:1<br>Level: AA</span>
                </div>
                <div class="contrast-example-box" style="background:#4682B4; color:#FFFFFF;">
                     <span class="sample-text">Teks Normal</span>
                    <span class="ratio-level">Rasio: 4.6:1<br>Level: AA</span>
                </div>
                 <div class="contrast-example-box" style="background:#2E8B57; color:#000000;">
                     <span class="sample-text">Teks Normal</span>
                    <span class="ratio-level">Rasio: 4.5:1<br>Level: AA</span>
                </div>
            </div>
             <p>Menggunakan <a href="https://webaim.org/resources/contrastchecker/" target="_blank" style="color: var(--list-marker-color);">alat pemeriksa kontras online</a> sangat direkomendasikan untuk memastikan kombinasi warna Anda memenuhi persyaratan WCAG.</p>
            <p><strong>Tips Penting untuk Desain yang Aksesibel:</strong></p>
             <ul class="tips-list">
                 <li>Selalu gunakan <strong>kontras kecerahan yang kuat</strong> (warna gelap vs warna terang). Ini adalah kunci terpenting.</li>
                 <li>Hindari pasangan warna yang sering membingungkan jika digunakan bersamaan tanpa kontras kecerahan yang cukup: <strong>Merah &amp; Hijau</strong>, <strong>Hijau &amp; Coklat</strong>, <strong>Biru &amp; Ungu</strong> (jika nuansanya mirip), <strong>Biru &amp; Hijau</strong>, <strong>Abu-abu &amp; Pink</strong>, <strong>Kuning &amp; Oranye</strong> (terutama jika kecerahannya mirip).</li>
                 <li>Tambahkan pola atau tekstur selain warna untuk membedakan elemen penting (misal: grafik batang dengan pola garis berbeda).</li>
                 <li>Untuk teks, pastikan rasio kontras warna latar dan teks memenuhi standar aksesibilitas (WCAG). Ada banyak alat online untuk memeriksa rasio kontras.</li>
             </ul>

        </div>


         <div class="card color-mixer-tool">
            <h2>Simulasi Pencampuran Warna Interaktif</h2>

             <div class="color-mixer-options">
                 <label for="numColorsSelect">Jumlah Warna yang Dicampur:</label>
                 <div class="custom-select-wrapper"> <select id="numColorsSelect">
                         <option value="2">2 Warna</option>
                         <option value="3">3 Warna</option>
                         <option value="4">4 Warna</option>
                     </select>
                 </div>
             </div>


            <p>Pilih jumlah warna di atas, lalu masukkan nilai komponen RGB/CMYK ATAU masukkan Kode Hex (#RRGGBB) atau Nama Warna HTML (seperti 'red', 'blue') di input teks di bawahnya. Jika input teks diisi, nilai angka diabaikan.</p>

            <div class="color-inputs" id="colorInputsContainer">
                <div class="color-input-container" id="colorInputContainer_1">
                    <div class="color-input-group">
                        <h3>Warna 1</h3>
                         <div class="color-mode-select">
                            <input type="radio" name="color1_mode" value="rgb" id="color1_rgb" checked> <label for="color1_rgb">RGB</label>
                            <input type="radio" name="color1_mode" value="cmyk" id="color1_cmyk"> <label for="color1_cmyk">CMYK</label>
                        </div>
                        <div class="color-sliders rgb-inputs-1">
                            <label for="color1_r">R (0-255):</label><input type="number" id="color1_r" min="0" max="255" value="0">
                            <label for="color1_g">G (0-255):</label><input type="number" id="color1_g" min="0" max="255" value="0">
                            <label for="color1_b">B (0-255):</label><input type="number" id="color1_b" min="0" max="255" value="0">
                        </div>
                         <div class="color-sliders cmyk-inputs-1" style="display: none;">
                            <label for="color1_c">C (0-255):</label><input type="number" id="color1_c" min="0" max="255" value="0">
                            <label for="color1_m">M (0-255):</label><input type="number" id="color1_m" min="0" max="255" value="0">
                            <label for="color1_y">Y (0-255):</label><input type="number" id="color1_y" min="0" max="255" value="0">
                            <label for="color1_k">K (0-255):</label><input type="number" id="color1_k" min="0" max="255" value="0">
                        </div>
                        <div class="color-text-input">
                             <label for="color1_text">Hex atau Nama Warna:</label>
                             <input type="text" id="color1_text" placeholder="#RRGGBB, red, blue etc.">
                        </div>
                    </div>
                </div>

                 <div class="color-input-container" id="colorInputContainer_2">
                    <div class="color-input-group">
                        <h3>Warna 2</h3>
                         <div class="color-mode-select">
                            <input type="radio" name="color2_mode" value="rgb" id="color2_rgb" checked> <label for="color2_rgb">RGB</label>
                            <input type="radio" name="color2_mode" value="cmyk" id="color2_cmyk"> <label for="color2_cmyk">CMYK</label>
                        </div>
                        <div class="color-sliders rgb-inputs-2">
                            <label for="color2_r">R (0-255):</label><input type="number" id="color2_r" min="0" max="255" value="0">
                            <label for="color2_g">G (0-255):</label><input type="number" id="color2_g" min="0" max="255" value="0">
                            <label for="color2_b">B (0-255):</label><input type="number" id="color2_b" min="0" max="255" value="0">
                        </div>
                         <div class="color-sliders cmyk-inputs-2" style="display: none;">
                            <label for="color2_c">C (0-255):</label><input type="number" id="color2_c" min="0" max="255" value="0">
                            <label for="color2_m">M (0-255):</label><input type="number" id="color2_m" min="0" max="255" value="0">
                            <label for="color2_y">Y (0-255):</label><input type="number" id="color2_y" min="0" max="255" value="0">
                            <label for="color2_k">K (0-255):</label><input type="number" id="color2_k" min="0" max="255" value="0">
                        </div>
                        <div class="color-text-input">
                             <label for="color2_text">Hex atau Nama Warna:</label>
                             <input type="text" id="color2_text" placeholder="#RRGGBB, red, blue etc.">
                        </div>
                    </div>
                </div>

                 <div class="color-input-container" id="colorInputContainer_3" style="display: none;">
                    <div class="color-input-group">
                        <h3>Warna 3</h3>
                         <div class="color-mode-select">
                            <input type="radio" name="color3_mode" value="rgb" id="color3_rgb" checked> <label for="color3_rgb">RGB</label>
                            <input type="radio" name="color3_mode" value="cmyk" id="color3_cmyk"> <label for="color3_cmyk">CMYK</label>
                        </div>
                        <div class="color-sliders rgb-inputs-3">
                            <label for="color3_r">R (0-255):</label><input type="number" id="color3_r" min="0" max="255" value="0">
                            <label for="color3_g">G (0-255):</label><input type="number" id="color3_g" min="0" max="255" value="0">
                            <label for="color3_b">B (0-255):</label><input type="number" id="color3_b" min="0" max="255" value="0">
                        </div>
                         <div class="color-sliders cmyk-inputs-3" style="display: none;">
                            <label for="color3_c">C (0-255):</label><input type="number" id="color3_c" min="0" max="255" value="0">
                            <label for="color3_m">M (0-255):</label><input type="number" id="color3_m" min="0" max="255" value="0">
                            <label for="color3_y">Y (0-255):</label><input type="number" id="color3_y" min="0" max="255" value="0">
                            <label for="color3_k">K (0-255):</label><input type="number" id="color3_k" min="0" max="255" value="0">
                        </div>
                        <div class="color-text-input">
                             <label for="color3_text">Hex atau Nama Warna:</label>
                             <input type="text" id="color3_text" placeholder="#RRGGBB, red, blue etc.">
                        </div>
                    </div>
                </div>

                 <div class="color-input-container" id="colorInputContainer_4" style="display: none;">
                    <div class="color-input-group">
                        <h3>Warna 4</h3>
                         <div class="color-mode-select">
                            <input type="radio" name="color4_mode" value="rgb" id="color4_rgb" checked> <label for="color4_rgb">RGB</label>
                            <input type="radio" name="color4_mode" value="cmyk" id="color4_cmyk"> <label for="color4_cmyk">CMYK</label>
                        </div>
                        <div class="color-sliders rgb-inputs-4">
                            <label for="color4_r">R (0-255):</label><input type="number" id="color4_r" min="0" max="255" value="0">
                            <label for="color4_g">G (0-255):</label><input type="number" id="color4_g" min="0" max="255" value="0">
                            <label for="color4_b">B (0-255):</label><input type="number" id="color4_b" min="0" max="255" value="0">
                        </div>
                         <div class="color-sliders cmyk-inputs-4" style="display: none;">
                            <label for="color4_c">C (0-255):</label><input type="number" id="color4_c" min="0" max="255" value="0">
                            <label for="color4_m">M (0-255):</label><input type="number" id="color4_m" min="0" max="255" value="0">
                            <label for="color4_y">Y (0-255):</label><input type="number" id="color4_y" min="0" max="255" value="0">
                            <label for="color4_k">K (0-255):</label><input type="number" id="color4_k" min="0" max="255" value="0">
                        </div>
                        <div class="color-text-input">
                             <label for="color4_text">Hex atau Nama Warna:</label>
                             <input type="text" id="color4_text" placeholder="#RRGGBB, red, blue etc.">
                        </div>
                    </div>
                </div>


            </div>

            <button class="mixer-button" id="cbMixBtn">Campurkan Warna</button>

            <div class="color-output">
                <h3>Hasil Pencampuran</h3>
                <div id="mixedColorBox" class="mixed-color-box"></div>
                <div class="color-codes">
                    <p id="mixedColorHex">Hex: #000000</p>
                    <p id="mixedColorRgb">RGB: rgb(0, 0, 0)</p>
                    <p id="mixedColorCmyk">CMYK: cmyk(0, 0, 0, 0)</p>
                </div>
            </div>
        </div>

    </div></body>
</html>`;

function initColorBlind(page) {
  // Dark mode mengikuti tema aplikasi
  const isDark = document.documentElement.classList.contains('dark') ||
                 document.documentElement.getAttribute('data-theme') === 'dark' ||
                 document.body.classList.contains('dark-mode');
  page.classList.toggle('dark-mode', isDark);

  const htmlColorNames = {
    "black": "#000000", "silver": "#C0C0C0", "gray": "#808080", "white": "#FFFFFF",
    "maroon": "#800000", "red": "#FF0000", "purple": "#800080", "fuchsia": "#FF00FF",
    "green": "#008000", "lime": "#00FF00", "olive": "#808000", "yellow": "#FFFF00",
    "navy": "#000080", "blue": "#0000FF", "teal": "#008080", "aqua": "#00FFFF",
    "orange": "#FFA500", "pink": "#FFC0CB", "cyan": "#00FFFF",
    "lightcoral": "#F08080", "salmon": "#FA8072", "indianred": "#CD5C5C", "crimson": "#DC143C",
    "firebrick": "#B22222", "darkred": "#8B0000",
    "lightgreen": "#90EE90", "palegreen": "#98FB98", "mediumspringgreen": "#00FA9A",
    "limegreen": "#32CD32", "forestgreen": "#228B22", "darkgreen": "#006400",
    "lightblue": "#ADD8E6", "skyblue": "#87CEEB", "dodgerblue": "#1E90FF",
    "royalblue": "#4169E1", "darkblue": "#00008B",
    "chartreuse": "#7FFF00", "greenyellow": "#ADFF2F", "yellowgreen": "#9ACD32",
    "seagreen": "#2E8B57", "lightseagreen": "#20B2AA", "springgreen": "#00FF7F",
    "mediumseagreen": "#3CB371", "darkslategray": "#2F4F4F", "darkcyan": "#008B8B",
    "turquoise": "#40E0D0", "mediumturquoise": "#48D1CC", "paleturquoise": "#AFEEEE",
    "darkturquoise": "#00CED1", "brown": "#A52A2A", "tomato": "#FF6347", "orangered": "#FF4500",
    "darksalmon": "#E9967A", "coral": "#FF7F50", "peachpuff": "#FFDAB9", "mistyrose": "#FFE4E1",
    "lavenderblush": "#FFF0F5", "mediumblue": "#0000CD", "steelblue": "#4682B4",
    "cadetblue": "#5F9EA0", "lightskyblue": "#87CEFA", "lightsteelblue": "#B0C4DE",
    "cornflowerblue": "#6495ED", "deepskyblue": "#00BFFF",
    "indigo": "#4B0082", "chocolate": "#D2691E", "darkgray": "#A9A9A9"
  };

  function cmykToRgb(c, m, y, k) {
    c = c / 255; m = m / 255; y = y / 255; k = k / 255;
    return {
      r: Math.round(255 * (1 - c) * (1 - k)),
      g: Math.round(255 * (1 - m) * (1 - k)),
      b: Math.round(255 * (1 - y) * (1 - k))
    };
  }

  function rgbToCmyk(r, g, b) {
    r = r / 255; g = g / 255; b = b / 255;
    const k = 1 - Math.max(r, g, b);
    let c = (1 - r - k) / (1 - k);
    let m = (1 - g - k) / (1 - k);
    let y = (1 - b - k) / (1 - k);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round((isNaN(v) ? 0 : v) * 255)));
    return { c: clamp(c), m: clamp(m), y: clamp(y), k: clamp(k) };
  }

  function rgbToHex(r, g, b) {
    const toHex = (c) => {
      const h = Math.max(0, Math.min(255, c)).toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const num = parseInt(hex, 16);
    if (isNaN(num) || hex.length !== 6) return null;
    return { r: (num >> 16) & 0xFF, g: (num >> 8) & 0xFF, b: num & 0xFF };
  }

  function getColorValues(colorNumber) {
    const textInput = page.querySelector(`#color${colorNumber}_text`).value.trim().toLowerCase();
    let rgb = { r: 0, g: 0, b: 0 };
    let cmyk = { c: 0, m: 0, y: 0, k: 0 };
    let usedInputType = 'number';

    if (textInput) {
      if (htmlColorNames[textInput]) {
        rgb = hexToRgb(htmlColorNames[textInput]);
        usedInputType = 'name';
        cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
      } else if (/^#?([a-f0-9]{3}){1,2}$/.test(textInput)) {
        const parsed = hexToRgb(textInput);
        if (parsed) {
          rgb = parsed; usedInputType = 'hex';
          cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
        } else { rgb = null; usedInputType = 'invalid-text'; }
      } else {
        rgb = null;
      }
    }

    if (usedInputType === 'number' || usedInputType === 'invalid-text' || !rgb) {
      const mode = page.querySelector(`input[name="color${colorNumber}_mode"]:checked`).value;
      if (mode === 'rgb') {
        const r = parseInt(page.querySelector(`#color${colorNumber}_r`).value) || 0;
        const g = parseInt(page.querySelector(`#color${colorNumber}_g`).value) || 0;
        const b = parseInt(page.querySelector(`#color${colorNumber}_b`).value) || 0;
        rgb = { r: Math.max(0, Math.min(255, r)), g: Math.max(0, Math.min(255, g)), b: Math.max(0, Math.min(255, b)) };
        cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
      } else {
        const c = parseInt(page.querySelector(`#color${colorNumber}_c`).value) || 0;
        const m = parseInt(page.querySelector(`#color${colorNumber}_m`).value) || 0;
        const y = parseInt(page.querySelector(`#color${colorNumber}_y`).value) || 0;
        const k = parseInt(page.querySelector(`#color${colorNumber}_k`).value) || 0;
        cmyk = { c: Math.max(0, Math.min(255, c)), m: Math.max(0, Math.min(255, m)), y: Math.max(0, Math.min(255, y)), k: Math.max(0, Math.min(255, k)) };
        rgb = cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
      }
      usedInputType = 'number-' + mode;
    }

    rgb.r = isNaN(rgb.r) ? 0 : rgb.r;
    rgb.g = isNaN(rgb.g) ? 0 : rgb.g;
    rgb.b = isNaN(rgb.b) ? 0 : rgb.b;
    return { rgb, cmyk, usedInputType };
  }

  function mixColors() {
    const numColorsToMix = parseInt(page.querySelector('#numColorsSelect').value);
    let totalR = 0, totalG = 0, totalB = 0;
    for (let i = 1; i <= numColorsToMix; i++) {
      const color = getColorValues(i);
      if (color.rgb) {
        totalR += color.rgb.r; totalG += color.rgb.g; totalB += color.rgb.b;
      }
    }
    const divisor = numColorsToMix > 0 ? numColorsToMix : 1;
    const mixedR = Math.round(totalR / divisor);
    const mixedG = Math.round(totalG / divisor);
    const mixedB = Math.round(totalB / divisor);
    const mixedHex = rgbToHex(mixedR, mixedG, mixedB);
    const cmykObj = rgbToCmyk(mixedR, mixedG, mixedB);
    page.querySelector('#mixedColorBox').style.backgroundColor = mixedHex;
    page.querySelector('#mixedColorHex').textContent = `Hex: ${mixedHex}`;
    page.querySelector('#mixedColorRgb').textContent = `RGB: rgb(${mixedR}, ${mixedG}, ${mixedB})`;
    page.querySelector('#mixedColorCmyk').textContent = `CMYK: cmyk(${cmykObj.c}, ${cmykObj.m}, ${cmykObj.y}, ${cmykObj.k})`;
  }

  function toggleInputs(colorNumber, mode) {
    const rgbInputs = page.querySelector(`.rgb-inputs-${colorNumber}`);
    const cmykInputs = page.querySelector(`.cmyk-inputs-${colorNumber}`);
    if (rgbInputs && cmykInputs) {
      rgbInputs.style.display = mode === 'rgb' ? 'block' : 'none';
      cmykInputs.style.display = mode === 'cmyk' ? 'block' : 'none';
    }
  }

  function updateVisibleColorInputs() {
    const numToShow = parseInt(page.querySelector('#numColorsSelect').value);
    page.querySelectorAll('.color-input-container').forEach((container, index) => {
      container.style.display = index < numToShow ? 'block' : 'none';
    });
    page.querySelectorAll('.color-input-container').forEach((container) => {
      if (container.style.display !== 'none') {
        const colorNum = container.id.replace('colorInputContainer_', '');
        const modeRadio = page.querySelector(`input[name="color${colorNum}_mode"]:checked`);
        toggleInputs(parseInt(colorNum), modeRadio ? modeRadio.value : 'rgb');
      }
    });
    mixColors();
  }

  const numColorsSelect = page.querySelector('#numColorsSelect');
  page.querySelector('#cbMixBtn').addEventListener('click', mixColors);
  page.querySelectorAll('.color-mode-select input[type="radio"]').forEach((radio) => {
    radio.addEventListener('change', (event) => {
      const colorNum = event.target.name.replace('color', '').replace('_mode', '');
      toggleInputs(parseInt(colorNum), event.target.value);
      mixColors();
    });
  });
  numColorsSelect.addEventListener('change', updateVisibleColorInputs);
  page.querySelectorAll('.color-mixer-tool input[type="number"], .color-mixer-tool input[type="text"]').forEach((input) => {
    input.addEventListener('input', mixColors);
  });

  updateVisibleColorInputs();
}

export function render() {
  const page = createEl('div', { class: 'cb-root' });
  const style = document.createElement('style');
  style.textContent = CSS;
  page.appendChild(style);
  page.insertAdjacentHTML('beforeend', BODY);
  initColorBlind(page);
  return page;
}
