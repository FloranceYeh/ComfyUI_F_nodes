import { app } from "../../scripts/app.js";

const SWITCH_NODE_NAMES = new Set(["F_DynamicSwitch", "F_DynamicMultiSwitch"]);
const RELAY_NODE_NAMES = new Set(["F_DynamicRelay"]);
const MAX_SLOTS = 64;

function hasLinks(output) {
    return Array.isArray(output?.links) && output.links.length > 0;
}

function hasInputLink(input) {
    return input?.link != null;
}

function sanitizeLabel(text) {
    const value = String(text ?? "").trim();
    if (!value || value === "*") return "";

    const low = value.toLowerCase();
    if (/^in_?\d+$/.test(low) || /^out_?\d+$/.test(low)) return "";
    return value;
}

function labelFromSlot(slot) {
    if (!slot) return "";
    return sanitizeLabel(slot.label) || sanitizeLabel(slot.name) || sanitizeLabel(slot.type);
}

function getRelaySlotLabel(node, idx) {
    const graph = node?.graph;
    if (!graph) return "";

    const input = node.inputs?.[idx];
    if (input?.link != null) {
        const inLink = graph.links?.[input.link];
        if (inLink) {
            const originNode = graph._nodes_by_id?.[inLink.origin_id];
            const originSlot = originNode?.outputs?.[inLink.origin_slot];
            const label = labelFromSlot(originSlot);
            if (label) return label;
        }
    }

    const output = node.outputs?.[idx];
    if (Array.isArray(output?.links)) {
        for (const linkId of output.links) {
            const outLink = graph.links?.[linkId];
            if (!outLink) continue;
            const targetNode = graph._nodes_by_id?.[outLink.target_id];
            const targetSlot = targetNode?.inputs?.[outLink.target_slot];
            const label = labelFromSlot(targetSlot);
            if (label) return label;
        }
    }

    return "";
}

function getRelayLabelStore(node) {
    if (!node.properties) {
        node.properties = {};
    }
    if (!node.properties.__fRelaySlotLabels || typeof node.properties.__fRelaySlotLabels !== "object") {
        node.properties.__fRelaySlotLabels = {};
    }
    return node.properties.__fRelaySlotLabels;
}

function hideWidget(widget) {
    if (widget.__fHidden) return;
    widget.__fOriginalType = widget.type;
    widget.__fOriginalComputeSize = widget.computeSize;
    widget.__fOriginalHidden = widget.hidden;
    widget.hidden = true;
    widget.type = "hidden";
    widget.computeSize = () => [0, -4];
    widget.__fHidden = true;
}

function showWidget(widget) {
    if (!widget.__fHidden) return;
    widget.type = widget.__fOriginalType || "toggle";
    widget.hidden = widget.__fOriginalHidden ?? false;
    if (widget.__fOriginalComputeSize) {
        widget.computeSize = widget.__fOriginalComputeSize;
    } else {
        delete widget.computeSize;
    }
    delete widget.__fOriginalHidden;
    widget.__fHidden = false;
}

function normalizeMultiSwitchWidgets(node) {
    if (node.comfyClass !== "F_DynamicMultiSwitch" || !Array.isArray(node.widgets)) return;

    const outputCount = Array.isArray(node.outputs) && node.outputs.length > 0 ? node.outputs.length : 1;

    for (const widget of node.widgets) {
        if (!widget?.name) continue;
        const match = String(widget.name).match(/active_(\d+)/i);
        if (!match) continue;
        const idx = Number.parseInt(match[1], 10);
        if (Number.isNaN(idx)) continue;

        if (idx < outputCount) {
            showWidget(widget);
        } else {
            hideWidget(widget);
        }
    }
}

function normalizeOutputs(node) {
    if (!node.outputs || node.outputs.length === 0) {
        node.addOutput("out_0", "*");
    }

    let lastConnected = -1;
    for (let i = node.outputs.length - 1; i >= 0; i -= 1) {
        if (hasLinks(node.outputs[i])) {
            lastConnected = i;
            break;
        }
    }

    const expected = Math.min(MAX_SLOTS, Math.max(1, lastConnected + 2));

    while (node.outputs.length > expected) {
        node.removeOutput(node.outputs.length - 1);
    }

    while (node.outputs.length < expected) {
        const next = node.outputs.length;
        node.addOutput(`out_${next}`, "*");
    }

    for (let i = 0; i < node.outputs.length; i += 1) {
        node.outputs[i].name = `out_${i}`;
        node.outputs[i].type = "*";
    }
}

function normalizeRelayIO(node) {
    if (!node.inputs || node.inputs.length === 0) {
        node.addInput("in_0", "*");
    }
    if (!node.outputs || node.outputs.length === 0) {
        node.addOutput("out_0", "*");
    }

    let lastConnectedInput = -1;
    for (let i = node.inputs.length - 1; i >= 0; i -= 1) {
        if (hasInputLink(node.inputs[i])) {
            lastConnectedInput = i;
            break;
        }
    }

    let lastConnectedOutput = -1;
    for (let i = node.outputs.length - 1; i >= 0; i -= 1) {
        if (hasLinks(node.outputs[i])) {
            lastConnectedOutput = i;
            break;
        }
    }

    const expected = Math.min(MAX_SLOTS, Math.max(1, Math.max(lastConnectedInput, lastConnectedOutput) + 2));

    while (node.inputs.length > expected) {
        node.removeInput(node.inputs.length - 1);
    }
    while (node.outputs.length > expected) {
        node.removeOutput(node.outputs.length - 1);
    }

    while (node.inputs.length < expected) {
        const next = node.inputs.length;
        node.addInput(`in_${next}`, "*");
    }
    while (node.outputs.length < expected) {
        const next = node.outputs.length;
        node.addOutput(`out_${next}`, "*");
    }

    const labelStore = getRelayLabelStore(node);

    for (let i = 0; i < expected; i += 1) {
        const dynamicLabel = getRelaySlotLabel(node, i);
        if (dynamicLabel) {
            labelStore[i] = dynamicLabel;
        }
        const persistedLabel = typeof labelStore[i] === "string" ? labelStore[i] : "";
        const finalLabel = dynamicLabel || persistedLabel;

        node.inputs[i].name = `in_${i}`;
        node.inputs[i].type = "*";
        node.outputs[i].name = `out_${i}`;
        node.outputs[i].type = "*";

        // 保持真实键名不变，仅修改显示文本，避免影响后端入参键。
        if (finalLabel) {
            node.inputs[i].label = finalLabel;
            node.outputs[i].label = finalLabel;
        } else {
            delete node.inputs[i].label;
            delete node.outputs[i].label;
        }
    }
}

app.registerExtension({
    name: "F_nodes.DynamicSwitch",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!SWITCH_NODE_NAMES.has(nodeData.name) && !RELAY_NODE_NAMES.has(nodeData.name)) return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = originalOnNodeCreated ? originalOnNodeCreated.apply(this, arguments) : undefined;

            if (SWITCH_NODE_NAMES.has(this.comfyClass)) {
                normalizeOutputs(this);
                normalizeMultiSwitchWidgets(this);
            } else if (RELAY_NODE_NAMES.has(this.comfyClass)) {
                normalizeRelayIO(this);
            }
            this.setSize(this.computeSize());

            return r;
        };

        const originalOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = originalOnConfigure ? originalOnConfigure.apply(this, arguments) : undefined;

            if (SWITCH_NODE_NAMES.has(this.comfyClass)) {
                normalizeOutputs(this);
                normalizeMultiSwitchWidgets(this);
            } else if (RELAY_NODE_NAMES.has(this.comfyClass)) {
                normalizeRelayIO(this);
            }
            this.setSize(this.computeSize());
            this.setDirtyCanvas(true, true);

            return r;
        };

        const originalOnConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type, index, connected, linkInfo) {
            const r = originalOnConnectionsChange
                ? originalOnConnectionsChange.apply(this, arguments)
                : undefined;

            if (SWITCH_NODE_NAMES.has(this.comfyClass)) {
                // 2 = outputs
                if (type !== 2 || !this.outputs || this.outputs.length === 0) {
                    return r;
                }
                normalizeOutputs(this);
                normalizeMultiSwitchWidgets(this);
            } else if (RELAY_NODE_NAMES.has(this.comfyClass)) {
                // 1 = inputs, 2 = outputs
                if ((type !== 1 && type !== 2) || !this.inputs || !this.outputs) {
                    return r;
                }
                normalizeRelayIO(this);
            }
            this.setSize(this.computeSize());

            this.setDirtyCanvas(true, true);
            return r;
        };

        const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            if (this.comfyClass === "F_DynamicMultiSwitch") {
                normalizeMultiSwitchWidgets(this);
            } else if (RELAY_NODE_NAMES.has(this.comfyClass)) {
                normalizeRelayIO(this);
            }
            if (originalOnDrawForeground) {
                return originalOnDrawForeground.apply(this, arguments);
            }
            return undefined;
        };
    },
});
