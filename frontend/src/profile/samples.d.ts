declare module 'virtual:resonance-profile-sample' {
  const sample: {
    synthetic: boolean
    design_mockup: boolean
    profile_id: string
    profile: import('./types').ProfileContent
  }
  export default sample
}

declare module 'virtual:resonance-document-samples' {
  const samples: {
    synthetic: boolean
    documents: { name: string; title: string; size: number; sha256: string }[]
  }
  export default samples
}
