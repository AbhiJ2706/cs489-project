// Dascore
// https://instantdb.com/dash?s=main&t=home&app=6624afdc-c7a0-4519-a142-f06f54a115b9

import { i } from "@instantdb/react";

const graph = i.graph(
  {
    "$files": i.entity({
      "path": i.any().unique().indexed(),
      "url": i.any(),
    }),
    "$users": i.entity({
      "email": i.any().unique().indexed(),
    }),
    "audio": i.entity({
      "storagePath": i.any(),
    }),
    "conversions": i.entity({
  
    }),
    "sheet": i.entity({
      "storagePath": i.any(),
      "title": i.any(),
    }),
  },
  {
    "audio$files": {
      "forward": {
        "on": "audio",
        "has": "one",
        "label": "$files"
      },
      "reverse": {
        "on": "$files",
        "has": "one",
        "label": "audio"
      }
    },
    "audio$users": {
      "forward": {
        "on": "audio",
        "has": "many",
        "label": "$users"
      },
      "reverse": {
        "on": "$users",
        "has": "many",
        "label": "audio"
      }
    },
    "conversions$files": {
      "forward": {
        "on": "conversions",
        "has": "many",
        "label": "$files"
      },
      "reverse": {
        "on": "$files",
        "has": "one",
        "label": "conversions"
      }
    },
    "conversionsAudio": {
      "forward": {
        "on": "conversions",
        "has": "many",
        "label": "audio"
      },
      "reverse": {
        "on": "audio",
        "has": "many",
        "label": "conversions"
      }
    },
    "conversionsSheet": {
      "forward": {
        "on": "conversions",
        "has": "many",
        "label": "sheet"
      },
      "reverse": {
        "on": "sheet",
        "has": "many",
        "label": "conversions"
      }
    },
    "sheet$files": {
      "forward": {
        "on": "sheet",
        "has": "one",
        "label": "$files"
      },
      "reverse": {
        "on": "$files",
        "has": "one",
        "label": "sheet"
      }
    },
    "sheet$users": {
      "forward": {
        "on": "sheet",
        "has": "many",
        "label": "$users"
      },
      "reverse": {
        "on": "$users",
        "has": "many",
        "label": "sheet"
      }
    }
  }
);

export default graph;
