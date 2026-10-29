# Louisiana Land Degradation Explorer

**Developed by Esi Dadzie (2026)**

An interactive **Google Earth Engine (GEE)** application for screening potential vegetation degradation across Louisiana's 64 parishes. Users can choose a parish and a calendar year (2001–2025), display changes in vegetation condition, view parish-level area summaries, and export a classified GeoTIFF.


## Open the application

**[Launch the Earth Engine App — (https://project-4a3b80c0-1308-4163-8d2.projects.earthengine.app/view/louisianalanddegradationexplorer)]**

## Repository contents

| File | Description |
| --- | --- |
| `Louisiana_Land_Degradation_Explorer.js` | Complete JavaScript source for the GEE Code Editor |
| `README.md` | Project overview and setup instructions |
| `Louisiana_Land_Degradation_Project_Manual_Esi_Dadzie.pdf` | Detailed technical manual and mathematical methodology |

## Data used

| Dataset | Earth Engine ID | Main use |
| --- | --- | --- |
| MODIS Terra Vegetation Indices, MOD13Q1 v6.1 | `MODIS/061/MOD13Q1` | NDVI and EVI, 250 m, 16-day observations |
| US Census TIGER 2018 Counties | `TIGER/2018/Counties` | Parish boundaries, filtered to Louisiana (`STATEFP = '22'`) |

NDVI and EVI pixel values are multiplied by `0.0001`. The `DetailedQA` band's lowest two bits are required to equal zero (good VI quality). The application uses annual median NDVI and EVI composites.

## Analytical approach

1. **Reference period:** Calculate annual medians for 2001–2005 and take their pixel-wise median to obtain reference NDVI and EVI.
2. **Target year:** Calculate the selected year's median NDVI and EVI.
3. **Change measures:** `NDVI_loss = NDVI_reference − NDVI_year`; `EVI_loss = EVI_reference − EVI_year`.
4. **Eligible vegetation:** Require baseline `NDVI ≥ 0.25` and baseline `EVI ≥ 0.15`, with valid current-year observations.
5. **Classes:**

   | Value | Class | Rule |
   | --- | --- | --- |
   | 0 | No detected decline | Does not satisfy both moderate thresholds |
   | 1 | Moderate decline | NDVI loss ≥ 0.08 **and** EVI loss ≥ 0.05, but not both severe thresholds |
   | 2 | Severe decline | NDVI loss ≥ 0.16 **and** EVI loss ≥ 0.10 |
   | 255 | NoData in exported file | Outside eligible/valid analysis mask |

6. **Area summaries:** Sum mapped pixel area within each class (km²). Potentially degraded area = moderate + severe. Percentage = 100 × (moderate + severe) / all assessed classes.

**Interpretation:** The map is a *potential vegetation-decline screening product*, not a definitive assessment of land degradation. The selected years 2001–2005 overlap the reference period, and results may be affected by drought, storm disturbance, land management, and land-cover conversion.

## Run the code

1. Open the [Google Earth Engine Code Editor](https://code.earthengine.google.com/).
2. Create a new script and paste the contents of `Louisiana_Land_Degradation_Explorer.js`.
3. Click **Run**. After the parish list loads, choose a parish and year and click **RUN DEGRADATION ANALYSIS**.
4. Check the area statistics and optional NDVI layers. For exports, click **EXPORT CLASSIFICATION TO GOOGLE DRIVE**, then open **Tasks** and run the task.
5. To share the interactive application, publish the saved script using **Apps** in Earth Engine and insert its public URL above.

## Documentation

For equations, step-by-step workflow, interpretation and dataset details, download [the technical project manual](Louisiana_Land_Degradation_Project_Manual_Esi_Dadzie.pdf).

## Suggested citation

Dadzie, E. (2026). *Louisiana Land Degradation Explorer: An Interactive Google Earth Engine Application for Parish-Level Vegetation Decline Assessment*. Source code and technical documentation.

## Author

**Esi Dadzie**
