import importlib


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


ANY_TYPE = AnyType("*")


class ByPassTypeTuple(tuple):
    def __getitem__(self, index):
        if index > 0:
            index = 0
        return super().__getitem__(index)


def _get_execution_blocker_cls():
    try:
        return importlib.import_module("comfy_execution.graph").ExecutionBlocker
    except Exception:
        return importlib.import_module("comfy_execution.graph_utils").ExecutionBlocker


class F_DynamicSwitch:
    """
    1 个任意输入，输出口保持为「已连接数量 n + 1」。
    通过 active_index 选择哪个输出口输出输入值，其他输出为 ExecutionBlocker。
    """

    MAX_OUTPUTS = 64

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "any_input": (ANY_TYPE,),
                "active_index": (
                    "INT",
                    {
                        "default": 0,
                        "min": 0,
                        "max": cls.MAX_OUTPUTS - 1,
                        "step": 1,
                        "display": "number",
                    },
                ),
            }
        }

    RETURN_TYPES = ByPassTypeTuple((ANY_TYPE,))
    RETURN_NAMES = ByPassTypeTuple(("out_0",))
    FUNCTION = "route"
    CATEGORY = "F_nodes"

    def route(self, any_input, active_index):
        ExecutionBlocker = _get_execution_blocker_cls()

        outputs = [ExecutionBlocker(None)] * self.MAX_OUTPUTS
        selected = min(max(int(active_index), 0), self.MAX_OUTPUTS - 1)
        outputs[selected] = any_input
        return tuple(outputs)


class F_DynamicMultiSwitch:
    """
    1 个任意输入，输出口保持为「已连接数量 n + 1」。
    通过 active_0..active_n 勾选同时激活多个输出，未激活输出为 ExecutionBlocker。
    """

    MAX_OUTPUTS = 64

    @classmethod
    def INPUT_TYPES(cls):
        required = {
            "any_input": (ANY_TYPE,),
        }
        for i in range(cls.MAX_OUTPUTS):
            required[f"active_{i}"] = (
                "BOOLEAN",
                {
                    "default": i == 0,
                    "label_on": f"ON #{i}",
                    "label_off": f"OFF #{i}",
                },
            )

        return {
            "required": required
        }

    RETURN_TYPES = ByPassTypeTuple((ANY_TYPE,))
    RETURN_NAMES = ByPassTypeTuple(("out_0",))
    FUNCTION = "route_multi"
    CATEGORY = "F_nodes"

    def route_multi(self, any_input, **kwargs):
        ExecutionBlocker = _get_execution_blocker_cls()

        outputs = [ExecutionBlocker(None)] * self.MAX_OUTPUTS
        for idx in range(self.MAX_OUTPUTS):
            if kwargs.get(f"active_{idx}", False):
                outputs[idx] = any_input
        return tuple(outputs)


class F_DynamicRelay:
    """
    左侧与右侧槽位一一对应的动态中转节点。
    槽位数量遵循 n + 1（n 为已连接槽位数），用于把同组参数分发到多个节点。
    """

    MAX_SLOTS = 64

    @classmethod
    def INPUT_TYPES(cls):
        optional = {}
        for i in range(cls.MAX_SLOTS):
            optional[f"in_{i}"] = (ANY_TYPE,)
        return {
            "optional": optional,
        }

    RETURN_TYPES = ByPassTypeTuple((ANY_TYPE,))
    RETURN_NAMES = ByPassTypeTuple(("out_0",))
    FUNCTION = "relay"
    CATEGORY = "F_nodes"

    def relay(self, **kwargs):
        ExecutionBlocker = _get_execution_blocker_cls()

        outputs = [ExecutionBlocker(None)] * self.MAX_SLOTS
        for idx in range(self.MAX_SLOTS):
            key = f"in_{idx}"
            if key in kwargs:
                outputs[idx] = kwargs[key]
        return tuple(outputs)


class F_KSamplerPreset:
    """
    KSampler 参数预设节点。
    无数据连线输入，直接输出常用采样参数供其他节点复用。
    """

    @classmethod
    def INPUT_TYPES(cls):
        comfy_samplers = importlib.import_module("comfy.samplers")

        return {
            "required": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xFFFFFFFFFFFFFFFF, "step": 1}),
                "steps": ("INT", {"default": 20, "min": 1, "max": 10000, "step": 1}),
                "cfg": ("FLOAT", {"default": 8.0, "min": 0.0, "max": 100.0, "step": 0.1}),
                "sampler_name": (comfy_samplers.KSampler.SAMPLERS,),
                "scheduler": (comfy_samplers.KSampler.SCHEDULERS,),
                "denoise": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
            }
        }

    RETURN_TYPES = ("INT", "INT", "FLOAT", ANY_TYPE, ANY_TYPE, "FLOAT")
    RETURN_NAMES = ("seed", "steps", "cfg", "sampler_name", "scheduler", "denoise")
    FUNCTION = "output_preset"
    CATEGORY = "F_nodes"

    def output_preset(self, seed, steps, cfg, sampler_name, scheduler, denoise):
        return (seed, steps, cfg, sampler_name, scheduler, denoise)


NODE_CLASS_MAPPINGS = {
    "F_DynamicSwitch": F_DynamicSwitch,
    "F_DynamicMultiSwitch": F_DynamicMultiSwitch,
    "F_DynamicRelay": F_DynamicRelay,
    "F_KSamplerPreset": F_KSamplerPreset,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "F_DynamicSwitch": "F Dynamic Switch",
    "F_DynamicMultiSwitch": "F Dynamic Multi Switch",
    "F_DynamicRelay": "F Dynamic Relay",
    "F_KSamplerPreset": "F KSampler Preset",
}

WEB_DIRECTORY = "./js"

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]

print()
print("<== F_nodes ==>")
print("\033[34m[F_nodes]\033[0m Loaded successfully.")
print("Nodes:")
for node_name in NODE_CLASS_MAPPINGS:
    display_name = NODE_DISPLAY_NAME_MAPPINGS.get(node_name, node_name)
    print(f"  - {display_name} ({node_name})")
print("<== F_nodes ==>")
