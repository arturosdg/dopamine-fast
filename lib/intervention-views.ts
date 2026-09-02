interface OpeningViewOptions {
  platformLabel: string;
  delaySeconds: number;
  defaultSessionLabel: string;
  availableLabel: string;
  usageMetrics: Array<{ label: string; duration: string }>;
}

interface SessionEndedViewOptions {
  platformLabel: string;
  availableLabel: string;
  replanDelaySeconds: number;
}

interface SessionPlanningViewOptions {
  platformLabel: string;
  defaultSessionLabel: string;
}

interface ElementOptions {
  className?: string;
  text?: string;
  attributes?: Record<string, string>;
  children?: Node[];
}

export function createOpeningView(options: OpeningViewOptions): HTMLElement {
  const pauseIndicator =
    options.delaySeconds > 0
      ? element("div", {
          className: "df-countdown",
          text: String(options.delaySeconds),
          attributes: { "aria-live": "polite" },
        })
      : element("div", {
          className: "df-pause-mark df-pause-mark--centered",
          attributes: { "aria-hidden": "true" },
        });
  const usageItems = options.usageMetrics.map((metric) =>
    element("div", {
      className: "df-usage-summary__item",
      children: [
        element("span", { text: metric.label }),
        element("strong", { text: metric.duration }),
      ],
    }),
  );

  return dialog(
    "df-opening-title",
    element("article", {
      className: "df-card df-card--opening",
      children: [
        element("p", {
          className: "df-kicker",
          text: "A pause before entering",
        }),
        pauseIndicator,
        element("h1", {
          text: `How much time do you want to spend on ${options.platformLabel}?`,
          attributes: { id: "df-opening-title" },
        }),
        element("p", {
          className: "df-copy",
          text: "Choose a defined session now. The timer will remain visible as you browse.",
        }),
        element("section", {
          className: "df-usage-summary",
          attributes: { "aria-labelledby": "df-usage-summary-title" },
          children: [
            element("p", {
              text: "Time spent today",
              attributes: { id: "df-usage-summary-title" },
            }),
            element("div", {
              className: "df-usage-summary__items",
              children: usageItems,
            }),
          ],
        }),
        timeStepper(
          "This session",
          options.defaultSessionLabel,
          "Adjust session length",
          "Choose a shorter session",
          "Add more session time",
        ),
        element("p", {
          className: "df-hard-limit-note",
          children: [
            document.createTextNode("You have "),
            element("strong", { text: options.availableLabel }),
            document.createTextNode(
              " left in today's limit for this network.",
            ),
          ],
        }),
        element("div", {
          className: "df-actions",
          children: [
            actionButton("Leave", "leave", "df-button df-button--quiet"),
            actionButton(
              options.delaySeconds > 0
                ? `Continue in ${options.delaySeconds}s`
                : `Start ${options.defaultSessionLabel} session`,
              "continue",
              "df-button df-button--primary",
              true,
            ),
          ],
        }),
        actionButton(
          "Adjust time and limits",
          "settings",
          "df-settings-link",
        ),
      ],
    }),
  );
}

export function createSessionEndedView(
  options: SessionEndedViewOptions,
): HTMLElement {
  return dialog(
    "df-session-end-title",
    element("article", {
      className: "df-card",
      children: [
        element("div", { className: "df-rule" }),
        element("p", {
          className: "df-kicker",
          text: "Planned time complete",
        }),
        element("h1", {
          text: "Your session has ended.",
          attributes: { id: "df-session-end-title" },
        }),
        element("p", {
          className: "df-copy",
          text: "You chose to stop here. Leave now, or pause before deliberately planning more time.",
        }),
        element("p", {
          className: "df-hard-limit-note",
          children: [
            document.createTextNode("Your daily ceiling cannot be extended: "),
            element("strong", { text: options.availableLabel }),
            document.createTextNode(" remaining."),
          ],
        }),
        element("div", {
          className: "df-actions",
          children: [
            actionButton(
              `Leave ${options.platformLabel}`,
              "leave",
              "df-button df-button--primary",
            ),
            actionButton(
              `Plan another block in ${options.replanDelaySeconds}s`,
              "plan",
              "df-button df-button--quiet",
              true,
            ),
          ],
        }),
        element("p", {
          className: "df-wait",
          text: "Take a moment before deciding.",
          attributes: { "aria-live": "polite" },
        }),
        actionButton(
          "Change the default",
          "settings",
          "df-settings-link",
        ),
      ],
    }),
  );
}

export function createSessionPlanningView(
  options: SessionPlanningViewOptions,
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(
    element("p", { className: "df-kicker", text: "Plan another block" }),
    element("h1", { text: "How much longer?" }),
    element("p", {
      className: "df-copy",
      text: "Choose a defined block within today's remaining ceiling.",
    }),
    timeStepper(
      "New block",
      options.defaultSessionLabel,
      "Adjust new block length",
      "Choose a shorter block",
      "Add more time to the block",
    ),
    element("div", {
      className: "df-actions",
      children: [
        actionButton(
          `Leave ${options.platformLabel}`,
          "leave",
          "df-button df-button--quiet",
        ),
        actionButton(
          `Start ${options.defaultSessionLabel} block`,
          "extend",
          "df-button df-button--primary",
        ),
      ],
    }),
    actionButton(
      "Change the default",
      "settings",
      "df-settings-link",
    ),
  );
  return fragment;
}

export function createHardLimitView(platformLabel: string): HTMLElement {
  return dialog(
    "df-hard-limit-title",
    element("article", {
      className: "df-card",
      children: [
        element("div", {
          className: "df-lock-mark",
          attributes: { "aria-hidden": "true" },
        }),
        element("p", {
          className: "df-kicker",
          text: "Daily limit reached",
        }),
        element("h1", {
          text: `${platformLabel} ends here for today.`,
          attributes: { id: "df-hard-limit-title" },
        }),
        element("p", {
          className: "df-copy",
          text: "This limit cannot be unlocked. It will be available again tomorrow.",
        }),
        element("div", {
          className: "df-actions df-actions--stack",
          children: [
            actionButton(
              `Leave ${platformLabel}`,
              "leave",
              "df-button df-button--primary",
            ),
          ],
        }),
        actionButton("View settings", "settings", "df-settings-link"),
      ],
    }),
  );
}

export function createAccessBlockedView(platformLabel: string): HTMLElement {
  return dialog(
    "df-access-block-title",
    element("article", {
      className: "df-card df-card--access-blocked",
      children: [
        element("div", {
          className: "df-lock-mark",
          attributes: { "aria-hidden": "true" },
        }),
        element("p", {
          className: "df-kicker",
          text: "Blocked hours",
        }),
        element("h1", {
          text: `${platformLabel} is blocked right now.`,
          attributes: { id: "df-access-block-title" },
        }),
        element("p", {
          className: "df-copy",
          text: "This schedule blocks every page on this network. Access returns when the blocked window ends.",
        }),
        element("div", {
          className: "df-actions df-actions--stack",
          children: [
            actionButton(
              `Leave ${platformLabel}`,
              "leave",
              "df-button df-button--primary",
            ),
          ],
        }),
        actionButton("View blocking schedule", "settings", "df-settings-link"),
      ],
    }),
    "df-backdrop df-backdrop--access-blocked",
  );
}

export function createUsageTimerView(): HTMLDivElement {
  return element("div", {
    className: "df-usage-timer",
    attributes: {
      role: "status",
      "aria-live": "polite",
    },
    children: [
      element("span", {
        className: "df-usage-timer__pulse",
        attributes: { "aria-hidden": "true" },
      }),
      element("span", {
        className: "df-usage-timer__copy",
        children: [
          element("strong", { attributes: { "data-timer": "planned" } }),
          element("small", {
            children: [
              element("span", {
                attributes: { "data-timer": "platform" },
              }),
              document.createTextNode(" · "),
              element("span", {
                attributes: { "data-timer": "daily" },
              }),
              document.createTextNode(" today"),
            ],
          }),
        ],
      }),
    ],
  });
}

function timeStepper(
  label: string,
  value: string,
  groupLabel: string,
  lessLabel: string,
  moreLabel: string,
): HTMLElement {
  return element("div", {
    className: "df-time-choice df-time-stepper",
    children: [
      element("span", { text: label }),
      element("output", {
        text: value,
        attributes: { "aria-live": "polite" },
      }),
      element("div", {
        className: "df-time-buttons",
        attributes: { role: "group", "aria-label": groupLabel },
        children: [
          actionButton("Less", "time-less", undefined, false, lessLabel),
          actionButton("Add time", "time-more", undefined, false, moreLabel),
        ],
      }),
    ],
  });
}

function dialog(
  labelledBy: string,
  card: HTMLElement,
  className = "df-backdrop",
): HTMLElement {
  return element("section", {
    className,
    attributes: {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": labelledBy,
    },
    children: [card],
  });
}

function actionButton(
  text: string,
  action: string,
  className?: string,
  disabled = false,
  ariaLabel?: string,
): HTMLButtonElement {
  const button = element("button", {
    className,
    text,
    attributes: {
      type: "button",
      "data-action": action,
      ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
    },
  });
  button.disabled = disabled;
  return button;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  Object.entries(options.attributes ?? {}).forEach(([name, value]) => {
    node.setAttribute(name, value);
  });
  node.append(...(options.children ?? []));
  return node;
}
