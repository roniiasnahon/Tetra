import axios from "axios";

async function main() {
  const query = "Resource Letter PS-2: Physics of Sports";
  const searchUrl = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=has_pdf_url:true&per-page=3&mailto=asnahonron@gmail.com`;
  console.log("Querying:", searchUrl);
  try {
    const res = await axios.get(searchUrl);
    const results = res.data.results || [];
    console.log(`Found ${results.length} results:`);
    for (const entry of results) {
      console.log("- Title:", entry.title);
      console.log("  Id:", entry.id);
      console.log("  DOI:", entry.doi);
      console.log("  pdf_url:", entry.best_oa_location?.pdf_url || entry.open_access?.oa_url);
      console.log("  locations count:", entry.locations?.length);
      if (entry.locations) {
        for (const loc of entry.locations) {
          console.log(`    * [${loc.landing_page_url}] -> PDF: ${loc.pdf_url}`);
        }
      }
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main();
