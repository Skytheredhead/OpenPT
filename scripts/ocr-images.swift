import AppKit
import Foundation
import Vision

let paths = Array(CommandLine.arguments.dropFirst())
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["en-US"]

func jsonEscape(_ value: String) -> String {
  var out = ""
  for scalar in value.unicodeScalars {
    switch scalar {
    case "\"": out += "\\\""
    case "\\": out += "\\\\"
    case "\n": out += "\\n"
    case "\r": out += "\\r"
    case "\t": out += "\\t"
    default:
      if scalar.value < 0x20 {
        out += String(format: "\\u%04x", scalar.value)
      } else {
        out.unicodeScalars.append(scalar)
      }
    }
  }
  return out
}

for path in paths {
  guard
    let image = NSImage(contentsOfFile: path),
    let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
  else {
    continue
  }

  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
  do {
    try handler.perform([request])
    let observations = (request.results ?? []).sorted { lhs, rhs in
      let dy = abs(lhs.boundingBox.midY - rhs.boundingBox.midY)
      if dy > 0.015 { return lhs.boundingBox.midY > rhs.boundingBox.midY }
      return lhs.boundingBox.minX < rhs.boundingBox.minX
    }
    let text = observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
    print("{\"path\":\"\(jsonEscape(path))\",\"text\":\"\(jsonEscape(text))\"}")
  } catch {
    fputs("OCR failed: \(path): \(error)\n", stderr)
  }
}
