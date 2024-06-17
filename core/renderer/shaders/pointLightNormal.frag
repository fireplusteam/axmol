#version 310 es
precision highp float;
precision highp int;

#include "base.glsl"

layout(location = POSITION) in vec3 v_vertexToPointLight;
layout(location = COLOR0) in vec4 v_color;
layout(location = TEXCOORD0) in vec2 v_texCoord;

layout(binding = 0) uniform sampler2D u_tex0;
layout(binding = 1) uniform sampler2D u_normalMap;

const int maxNum = 6;

layout(std140) uniform fs_ub
{
    vvec3_def(u_lightPos, maxNum);
    vvec3_def(u_lightColor, maxNum);
    vvec3_def(u_ambientColor, maxNum);
    vfloat_def(u_brightness, maxNum);
    vfloat_def(u_cutoffRadius, maxNum);
    vfloat_def(u_halfRadius, maxNum);
    // spot specific
    vvec3_def(u_lightDirection, maxNum);
    vfloat_def(u_cutoffSpotAngle, maxNum);
    vfloat_def(u_cutoffOuterSpotAngle, maxNum);

    int u_numOfDirectLights;
    int u_numOfPointLights;
    int u_numOfSpotLights;

    int u_isDefaultNormalColor;
};

layout(location = SV_Target0) out vec4 FragColor;

vec3 computeLight(vec3 normal, vec3 v_pos, int i)
{
    vec3 posToLight         = -normalize(v_pos);
    float normDotPosToLight = max(0.0, dot(normal, posToLight));

    float intercept       = vfloat_at(u_halfRadius, i);
    float dx_1            = 0.5 / intercept;
    float dx_2            = 0.5 / (vfloat_at(u_cutoffRadius, i) - intercept);
    float offset          = 0.5 + intercept * dx_2;
    float lightDist       = length(v_pos);
    float falloffTermNear = clamp((1.0 - lightDist * dx_1), 0.0, 1.0);
    float falloffTermFar  = clamp((offset - lightDist * dx_2), 0.0, 1.0);
    float falloffSelect   = step(intercept, lightDist);
    float falloffTerm     = (1.0 - falloffSelect) * falloffTermNear + falloffSelect * falloffTermFar;

    vec3 diffuse = normDotPosToLight * vfloat_at(u_brightness, i) * falloffTerm * vvec3_at(u_lightColor, i);
    return diffuse + vvec3_at(u_ambientColor, i);
}

void main(void)
{
    vec4 texColor = texture(u_tex0, v_texCoord);
    vec3 normal   = vec3(127.0f / 255.0f, 127.0f / 255.0f, 1.0f);
    if (u_isDefaultNormalColor == 0)
        normal = texture(u_normalMap, v_texCoord).rgb;
    normal = normal * 2.0 - 1.0;

    vec3 combine = vec3(0, 0, 0);
    int i        = 0;
    int end      = u_numOfDirectLights;  // direct
    for (; i < end; ++i)
    {
        float diffuse = max(0.0, dot(normal, -vvec3_at(u_lightDirection, i)));  // direction is normalised
        combine += diffuse * vfloat_at(u_brightness, i) * vvec3_at(u_lightColor, i) * vvec3_at(u_ambientColor, i);
    }
    end += u_numOfPointLights;  // point
    for (; i < end; ++i)
    {
        vec3 v_pos = v_vertexToPointLight - vvec3_at(u_lightPos, i);
        combine += computeLight(normal, v_pos, i);
    }
    end += u_numOfSpotLights;  // spot
    for (; i < end; ++i)
    {
        vec3 v_pos = v_vertexToPointLight - vvec3_at(u_lightPos, i);
        float theta =
            dot(normalize(vec3(v_pos.x, v_pos.y, -30)), vvec3_at(u_lightDirection, i));  // direction is normalised
        float epsilon   = vfloat_at(u_cutoffSpotAngle, i) - vfloat_at(u_cutoffOuterSpotAngle, i);
        float intensity = smoothstep(0.0, 1.0, (theta - vfloat_at(u_cutoffOuterSpotAngle, i)) / epsilon);
        combine += computeLight(normal, v_pos, i) * intensity;
    }
    FragColor = vec4(texColor.rgb * combine, texColor.a);
}
