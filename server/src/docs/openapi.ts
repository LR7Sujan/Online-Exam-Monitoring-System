export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ProctorIQ API',
    version: '1.0.0',
    description:
      'DBMS-centric Online Exam Monitoring & Anti-Cheating System API. Business rules, trust deductions, auto-termination, and grading run inside MySQL 8.0+ triggers and stored procedures.',
  },
  servers: [{ url: '/api', description: 'Local API Server' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      EnvelopeSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object', nullable: true },
          error: { type: 'object', nullable: true, example: null },
        },
      },
      EnvelopeError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          data: { type: 'object', nullable: true, example: null },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check & DB connectivity',
        security: [],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a STUDENT user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fullName', 'email', 'password'],
                properties: {
                  fullName: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Created with JWT' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and receive JWT with role claims',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'JWT token + user profile' } },
      },
    },
    '/exams/available': {
      get: {
        tags: ['Student'],
        summary: 'List published exams and window/session status for student',
        responses: { '200': { description: 'Available exams' } },
      },
    },
    '/exams/{id}/start': {
      post: {
        tags: ['Student'],
        summary: 'Start or resume an exam session (IP, fingerprint, session_token)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  deviceFingerprint: { type: 'string' },
                  sessionToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'New session created' },
          '200': { description: 'Existing active session resumed' },
          '409': { description: 'Duplicate session token/fingerprint mismatch or closed' },
        },
      },
    },
    '/exams': {
      get: { tags: ['Admin'], summary: 'List exams', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Admin'], summary: 'Create exam', responses: { '201': { description: 'Created' } } },
    },
    '/exams/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Get exam details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' } },
      },
      put: {
        tags: ['Admin'],
        summary: 'Update exam',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Updated' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete exam',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/exams/{id}/questions': {
      get: {
        tags: ['Admin'],
        summary: 'List exam questions (Admin/Proctor)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Add MCQ question',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '201': { description: 'Created' } },
      },
    },
    '/exams/{id}/questions/{questionId}': {
      put: {
        tags: ['Admin'],
        summary: 'Update MCQ question',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Updated' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete MCQ question',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/violation-types': {
      get: { tags: ['Admin'], summary: 'List violation types & penalty weights', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Admin'], summary: 'Create violation type', responses: { '201': { description: 'Created' } } },
    },
    '/violation-types/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update penalty weight or severity',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Updated' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete violation type',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/analytics/overview': {
      get: { tags: ['Analytics'], summary: 'Exam analytics overview (vw_ExamAnalytics)', responses: { '200': { description: 'OK' } } },
    },
    '/analytics/heatmap': {
      get: { tags: ['Analytics'], summary: 'Hourly violation heatmap (vw_ViolationHeatmap)', responses: { '200': { description: 'OK' } } },
    },
    '/sessions/{id}/questions': {
      get: {
        tags: ['Student'],
        summary: 'Fetch sanitized exam questions (never returns correct_option)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/sessions/{id}/time-left': {
      get: {
        tags: ['Student'],
        summary: 'Authoritative server timer remaining seconds',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/sessions/{id}/answer': {
      put: {
        tags: ['Student'],
        summary: 'Atomic UPSERT of student MCQ response',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['questionId', 'selectedOption'],
                properties: {
                  questionId: { type: 'integer' },
                  selectedOption: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Saved' } },
      },
    },
    '/sessions/{id}/violation': {
      post: {
        tags: ['Student'],
        summary: 'Log violation (rate-limited & 3s debounced); triggers trust deduction / termination',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: { type: 'string', example: 'TAB_SWITCH' },
                  snapshot: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Violation recorded' }, '429': { description: 'Rate limited' } },
      },
    },
    '/sessions/{id}/submit': {
      post: {
        tags: ['Student'],
        summary: 'Transactional grading via sp_SubmitAndGradeExam (FOR UPDATE locked)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Graded result' } },
      },
    },
    '/sessions/{id}/result': {
      get: {
        tags: ['Student'],
        summary: 'Get graded result and violation breakdown',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/monitor/live': {
      get: { tags: ['Proctor'], summary: 'Live proctor monitor (vw_ProctorLiveMonitor)', responses: { '200': { description: 'OK' } } },
    },
    '/monitor/audit': {
      get: { tags: ['Proctor'], summary: 'Violation audit report (vw_ViolationAuditReport)', responses: { '200': { description: 'OK' } } },
    },
    '/sessions/{id}/timeline': {
      get: {
        tags: ['Proctor'],
        summary: 'Full violation timeline for a session',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/logs/{logId}/review': {
      patch: {
        tags: ['Proctor'],
        summary: 'Confirm or dismiss a proctoring log (triggers trust score sync)',
        parameters: [{ name: 'logId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['CONFIRMED', 'DISMISSED'] },
                  reviewNotes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Updated' } },
      },
    },
    '/sessions/{id}/force-terminate': {
      post: {
        tags: ['Proctor'],
        summary: 'Force-terminate an active session and grade as DISQUALIFIED',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Terminated' } },
      },
    },
  },
};

