const Supplier = require('../models/suppliers_model');
const { sendResponse } = require('../utils/response_util');

function normalize(str) {
  return str.trim().replace(/\s+/g,' ');
}

async function createSupplier(req,res) {
  let { name,email,phone,address } = req.body;
  const userId = req.usuario.userId;
  if (!name||!email||!phone||!address) 
    return sendResponse(res,400,'error','Todos los campos requeridos');

  name = normalize(name);
  email = email.trim();

  if(await Supplier.findByEmailAndUser(email,userId))
    return sendResponse(res,409,'error','Ya existe un proveedor con ese correo');

  if(await Supplier.findByNameAndUser(name,userId))
    return sendResponse(res,409,'error','Ya existe un proveedor con ese nombre');

  const supplier = await Supplier.create({ name, email, phone, address, userId });
  return sendResponse(res,201,'success','Proveedor creado',supplier);
}

async function listSuppliers(req,res) {
  const suppliers = await Supplier.findAllByUser(req.usuario.userId);
  return sendResponse(res,200,'success','Proveedores obtenidos',suppliers);
}

async function getSupplier(req,res) {
  const supplier = await Supplier.findById(req.params.id,req.usuario.userId);
  if(!supplier) return sendResponse(res,404,'error','Proveedor no encontrado');
  return sendResponse(res,200,'success','Proveedor encontrado',supplier);
}

async function updateSupplier(req,res) {
  let { name,email,phone,address } = req.body;
  const userId = req.usuario.userId;
  const id = Number(req.params.id);
  name = normalize(name);
  email = email.trim();

  const byEmail = await Supplier.findByEmailAndUser(email,userId);
  if(byEmail && byEmail.id!==id)
    return sendResponse(res,409,'error','Ya existe un proveedor con ese correo');

  const byName = await Supplier.findByNameAndUser(name,userId);
  if(byName && byName.id!==id)
    return sendResponse(res,409,'error','Ya existe un proveedor con ese nombre');

  const updated = await Supplier.update(id,{ name,email,phone,address },userId);
  if(!updated) return sendResponse(res,404,'error','Proveedor no encontrado');
  return sendResponse(res,200,'success','Proveedor actualizado',updated);
}

async function deleteSupplier(req,res) {
  const deleted = await Supplier.delete(req.params.id,req.usuario.userId);
  if(!deleted) return sendResponse(res,404,'error','Proveedor no encontrado');
  return sendResponse(res,200,'success','Proveedor eliminado');
}

module.exports = { createSupplier,listSuppliers,getSupplier,updateSupplier,deleteSupplier };
