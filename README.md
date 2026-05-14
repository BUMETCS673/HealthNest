## Our Project

Our project is a unified AI-powered medical dashboard for both patients and providers. The idea comes from a common problem in healthcare, where important information is 
often spread across multiple systems, making it difficult for patients to understand medical instructions, billing details, and follow-up actions, 
while also creating extra coordination work for providers and care teams. 
The goal of the system is to bring important healthcare information and services into one place. At a high level, the system is intended to 
provide customized home dashboards, AI-assisted support, appointment scheduling, secure access to sensitive information, and one-click access to 
major services from the dashboard. The main users of the system are patients, doctors, and other care team members. 
The planned technology stack currently includes a React frontend, a FastAPI backend, along with database support, authentication, AI integration, testing/security tools, and CI/CD support.

## CI/CD / Commit Procedure

Jira: A ticket will be assigned to a developer and that task will have a ticket number

Feature: The first step is the feature branch. When a developer has to add a new feature or fix a bug they must create a feature branch first and title it with the name 
of the jira ticket first. Ex. “feature/Jira-XXXX-[name of the branch]”. Once the developer creates that branch they can pull from the main branch to get the most updated code. 
The developer will make their changes and will commit and push the feature branch.
Main: The developer will raise a PR to merge the feature branch to the main branch and the PR must be reviewed by at least one other developer before the author can merge the branch.

Release: We will then create a release branch to push the new feature or bug fix to the production code which will be deployed on vercel/AWS/Google Cloud. 
The naming convention for the release branch will be “release/release-X.XX”. The developer will then merge the main branch to the release branch.

Production: Once we are ready to push the release to production, we will approve and ship the release branch and host it.
