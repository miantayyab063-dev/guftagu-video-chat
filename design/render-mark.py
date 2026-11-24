"""Render Guftagu's overlapping speech bubbles and camera mark in Blender."""
from mathutils import Matrix, Vector
import bpy

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, rgb, metallic=0.18):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = 0.25
    return mat

def plate(name, points, position, depth, bevel, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '2D'
    curve.resolution_u = 16
    curve.fill_mode = 'BOTH'
    curve.extrude = depth
    curve.bevel_depth = bevel
    curve.bevel_resolution = 6
    rounded = []
    for k, pair in enumerate(points):
        corner = Vector(pair)
        radius = min(.14, (corner - Vector(points[k - 1])).length / 3, (corner - Vector(points[(k + 1) % len(points)])).length / 3)
        before = corner + (Vector(points[k - 1]) - corner).normalized() * radius
        after = corner + (Vector(points[(k + 1) % len(points)]) - corner).normalized() * radius
        for step in range(9):
            t = step / 8
            rounded.append(before * (1 - t) ** 2 + 2 * t * (1 - t) * corner + after * t ** 2)
    points = rounded
    outline = curve.splines.new('POLY')
    outline.points.add(len(points) - 1)
    for vertex, (x, y) in zip(outline.points, points):
        vertex.co = (x, y, 0, 1)
    outline.use_cyclic_u = True
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.data.materials.append(mat)
    return obj

blue = material('Cobalt enamel', (0.026, 0.19, 0.80))
orange = material('Orange enamel', (1, 0.22, 0.024), 0.08)
ink = material('Midnight blue enamel', (0.008, 0.023, 0.075), 0.22)
plate('Rear bubble', [(-.89,-.50),(.36,-.50),(.81,-.86),(.73,-.50),(.89,-.47),(.89,.59),(-.89,.59)], (.59,.40,-.04), .19,.12,blue)
plate('Front bubble', [(-1.04,-.55),(-.90,-.55),(-1.00,-.99),(-.39,-.55),(1.03,-.55),(1.03,.67),(-1.04,.67)], (-.27,-.10,.44), .22,.145,orange)
plate('Camera body', [(-.47,-.24),(.17,-.24),(.17,.26),(-.47,.26)], (-.27,-.03,.84), .026,.075,ink)
plate('Camera lens', [(.33,-.11),(.58,-.25),(.58,.27),(.33,.13)], (-.27,-.03,.84), .026,.047,ink)

def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z','Y').to_euler()

bpy.ops.object.camera_add(location=(3.4,-3.1,10))
camera = bpy.context.object
view = (camera.location - Vector((.08,-.10,.18))).normalized()
right = Vector((1,.16,0))
right = (right - right.dot(view) * view).normalized()
camera.rotation_euler = Matrix((right, view.cross(right), view)).transposed().to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 4.05
scene = bpy.context.scene
scene.camera = camera
for name, position, energy, size, color in [
    ('Warm key',(-3,3.5,6),560,4,(1,.89,.76)),
    ('Blue rim',(4,1,2.6),320,3,(.45,.65,1)),
    ('Soft fill',(-2,-5,4),120,4,(.76,.86,1)),
]:
    bpy.ops.object.light_add(type='AREA', location=position)
    lamp = bpy.context.object
    lamp.name = name
    lamp.data.energy = energy
    lamp.data.shape = 'DISK'
    lamp.data.size = size
    lamp.data.color = color
    aim(lamp, (0,0,0))
scene.world.color = (.29,.29,.29)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = '/tmp/guftagu-mark-render.png'
bpy.ops.render.render(write_still=True)
