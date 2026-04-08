import path from "node:path"
import fs, { mkdirSync, writeFileSync } from "node:fs"

export function writeToSetDirectory(fileName: string, contents: string) {
    const directory = path.join(__dirname, "../deployments")
    if (!fs.existsSync(directory)) mkdirSync(directory)
    
    const file = path.join(directory, `/${fileName}.json`)
    if (!fs.existsSync(file)) writeFileSync(file, contents)
}