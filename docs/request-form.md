# Gizlet request form delivery

The request form at `/request-a-gizlet/` uses GitHub Issues as its approved delivery mechanism. This is a deliberate static-site handoff, not a Gizlet form endpoint or a third-party form service.

## How it works

1. Browser-side code validates the required tool-idea field.
2. It creates a pre-filled new-issue URL for the public `BrewingBytes/Gizlet` repository.
3. The visitor reviews the draft on GitHub and explicitly submits it there.

Gizlet does not receive, store, or transmit request-form values. The form does not set an HTTP `action`, make a fetch request, or send analytics events containing the idea, use case, or contact information. Once a visitor continues to GitHub, any information they submit is handled by GitHub under [GitHub's Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-privacy-statement).

The page says “Your request is ready” rather than claiming that Gizlet received it: GitHub is the final submission step. This preserves the static-only architecture while keeping the delivery boundary and completion state truthful.
