# Policy CMS - University of Guyana

A modern, custom UI interface that enables powerful search capabilities for policies at the University of Guyana. This project provides a Google-like search experience for public policies while leveraging DSpace 9 as the backend repository system.

## Overview

The Policy CMS is a frontend application built with React and Vite that interfaces with a DSpace 9 backend to provide an intuitive search experience for university policies. The system allows staff to curate both public and private policies, with the public policies being accessible through this custom search interface.

## About the Developer

This project is also a personal learning and growth journey.

I am **Nickelcy Francois**, a developer intern, and this work reflects my focus on building useful tools that are clear and accessible for everyday users.

If you want to learn more about me, visit: **https://nicklecy.com**

## Architecture

### Backend
- **DSpace 9**: Core repository system for policy management
- **Angular Frontend**: Official DSpace admin interface
- **Tomcat**: Application server for backend deployment
- **Docker**: Containerized services for:
  - **Solr**: Search engine
  - **PostgreSQL**: Database

### Frontend (This Project)
- **React 18**: Modern UI framework
- **Vite**: Fast build tool and development server
- **Custom Search Interface**: Google-like search experience leveraging DSpace REST API

## Production Environment

- **Base URL**: `dspace.nickelcy.com`
- **API Endpoint**: `/server/api`
- **Search Endpoint**: `/server/api/discover/search/objects`

The DSpace repository is primarily for officials but remains publicly accessible for public content. Staff curate both public and private policies for reference. While public policies are accessible on the main DSpace interface, this custom UI provides a more user-friendly search experience for the public.

## Future Plans

- Build containerized images for production deployment
- Separate frontend and backend deployments
- Improved scalability and maintainability

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd policy-cms
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown in the terminal).

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `npm run lint` - Run ESLint

## API Integration

This application integrates with the DSpace REST API. For detailed API documentation, see [docs/dspace-api.md](./docs/dspace-api.md).
For endpoint-to-code usage mapping, see [docs/endpoints-usage.md](./docs/endpoints-usage.md).

### Key Endpoints

- **Search**: `/server/api/discover/search/objects`
  - Supports parameters: `sort`, `page`, `size`, `query`, `scope`, `embed`, `dsoType`, `filter`
  - The search interface uses a limit of 5 results for dropdown suggestions

For more information about the DSpace REST API contract, see: [DSpace REST Contract](https://github.com/DSpace/RestContract/blob/main/search-endpoint.md)

## Development

The development server is configured to listen on all network interfaces (`0.0.0.0`), making it accessible from other devices on your local network.

## Project Structure

```
policy-cms/
├── docs/              # Documentation
│   ├── designs/       # Design files
│   └── dspace-api.md  # API documentation
├── src/               # Source code
│   ├── App.jsx        # Main App component
│   ├── App.css        # App styles
│   ├── main.jsx       # Application entry point
│   └── index.css      # Global styles
├── index.html         # HTML template
├── vite.config.js     # Vite configuration
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## License
-


## Contributing
-
