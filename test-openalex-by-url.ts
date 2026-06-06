import axios from "axios";

async function main() {
  const pdfUrl = "https://pubs.aip.org/aapt/ajp/article-pdf/79/6/565/13111531/565_1_online.pdf";
  const queryUrl = `https://api.openalex.org/works?filter=locations.pdf_url:${encodeURIComponent(pdfUrl)}&mailto=asnahonron@gmail.com`;
  console.log("Searching OpenAlex for exact PDF URL:", queryUrl);
  try {
    const res = await axios.get(queryUrl);
    const results = res.data.results || [];
    console.log(`Found ${results.length} results:`);
    for (const entry of results) {
      console.log("- Title:", entry.title);
      console.log("  Id:", entry.id);
      console.log("  DOI:", entry.doi);
      console.log("  pdf_url:", entry.best_oa_location?.pdf_url || entry.open_access?.oa_url);
      if (entry.locations) {
        console.log("  Alternative locations:");
        for (const loc of entry.locations) {
          console.log(`    * [Landing: ${loc.landing_page_url}] -> PDF: ${loc.pdf_url}`);
        }
      }
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main();
