import "jszip"

declare module "jszip" {
  interface JSZipObject {
    // JSZip 3.10.2 implements this documented API but omits it from its declarations.
    // https://stuk.github.io/jszip/documentation/api_zipobject/internal_stream.html
    internalStream(type: "uint8array"): JSZipStreamHelper<Uint8Array>
  }
}
