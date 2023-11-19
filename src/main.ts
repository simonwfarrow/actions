import { debug, getInput, info, group, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { cp } from '@actions/io'
import { resolve } from 'node:path'

type Inputs = {
  likec4: string[]
  path: string
  output: string
  base: string
}

function asArg(name: string, value: string): string[] {
  if (value === '') {
    return []
  }
  debug(`${name}: ${value}`)
  return [name, value]
}

async function execBuild({
  likec4,
  path,
  output,
  base
}: Inputs): Promise<void> {
  const out = output || 'dist'
  const args = [
    ...asArg('--base', base),
    ...asArg('--output', out),
    path
  ]
  await group(`build website`, async () => {
    await exec('npx', [...likec4, 'build', ...args])    
    await cp(
      resolve(out, 'index.html'),
      resolve(out, '404.html'),
    )
  })
}

async function execExport({
  likec4,
  path,
  output
}: Inputs): Promise<void> {
  const args = [
    ...asArg('--output', output),
    path
  ]
  await group(`export: png`, async () => {
    await exec('npx', [...likec4, 'export', 'png', ...args])
  })
}

const CodegenCommands = [
  'react', 'views', 'ts', 'views-data', 'dot', 'd2', 'mermaid', 'mmd'
]
async function execCodegen(command: string, {
  likec4,
  path,
  output
}: Inputs): Promise<void> {
  const args = [
    command,
    ...asArg('-o', output),
    path
  ]
  await group(`codegen: ${command}`, async () => {
    await exec('npx', [...likec4, 'codegen', ...args])
  })
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const action = getInput('action')
    const exportTo = getInput('export')
    const codegen = getInput('codegen')

    const inputs: Inputs = {
      likec4: ['--no-install', 'likec4'],
      path: getInput('path'),
      output: getInput('output'),
      base: getInput('base')
    }

    const version = getInput('likec4-version')
    if (version !== '') {
      inputs.likec4 = [`likec4@${version}`]      
    }

    action != '' && debug(`action: ${action}`)
    exportTo != '' && debug(`export: ${exportTo}`)
    codegen != '' && debug(`codegen: ${codegen}`)
    debug(`cwd: ${process.cwd()}`)
    debug(`path: ${inputs.path}`)

    if (action === 'codegen' || (action === '' && codegen !== '')) {
      const command = codegen || 'react'
      if (!CodegenCommands.includes(command)) {
        setFailed(`invalid codegen: ${command}\nAllowed values: ${CodegenCommands.map(c => `"${c}"`).join(', ')}`)
        return
      }
      await execCodegen(command, inputs)
      return
    }

    if (action === 'export' || (action === '' && exportTo !== '')) {
      if (exportTo !== 'png') {
        setFailed(`invalid export: ${exportTo}\nAllowed values: png`)
        return
      }
      await execExport(inputs)
      return
    }

    if (action === 'build' || (action === '' && exportTo === '' && codegen === '')) {
      await execBuild(inputs)
      return
    }

    setFailed(`invalid input, can't determine action`)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) setFailed(error.message)
  }
}